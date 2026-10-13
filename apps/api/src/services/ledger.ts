import { randomInt } from 'node:crypto';
import type { Request } from 'express';
import mongoose, { type ClientSession, Types } from 'mongoose';
import { AppError, notFound } from '../lib/errors.js';
import type { Currency } from '../lib/money.js';
import { Contact } from '../models/Contact.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import { formatMinor } from '../lib/money.js';
import { logActivity } from './activity.js';
import { notify } from './notifications.js';

const oid = (s: string) => new Types.ObjectId(s);
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- balances: always derived from completed transactions, never stored or client-supplied ---------- */
export async function balances(ownerId: string, walletIds?: string[], session?: ClientSession) {
  const match: Record<string, unknown> = { ownerId: oid(ownerId), status: 'completed' };
  if (walletIds) match.walletId = { $in: walletIds.map(oid) };
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: '$walletId', net: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amountMinor', { $multiply: ['$amountMinor', -1] }] } } } },
  ]).session(session ?? null);
  return new Map<string, number>(rows.map((r: any) => [String(r._id), r.net as number]));
}

const walletView = (w: any, netMinor: number) => ({
  id: String(w._id), name: w.name, currency: w.currency as Currency,
  openingBalanceMinor: w.openingBalanceMinor, balanceMinor: w.openingBalanceMinor + netMinor,
  displayCode: w.displayCode, archived: Boolean(w.archivedAt), createdAt: w.createdAt, updatedAt: w.updatedAt,
});

/* ---------- wallets ---------- */
export async function createWallet(ownerId: string, input: { name: string; currency: Currency; openingBalanceMinor: number }, req: Request) {
  const w = await Wallet.create({ ownerId, ...input, displayCode: String(randomInt(0, 10000)).padStart(4, '0') });
  await logActivity(ownerId, 'wallet.create', req, { entityType: 'wallet', entityId: w.id, meta: { currency: input.currency } });
  return walletView(w, 0);
}

export async function listWallets(ownerId: string, includeArchived: boolean) {
  const rows = await Wallet.find({ ownerId, ...(includeArchived ? {} : { archivedAt: null }) }).sort({ createdAt: 1 }).lean();
  const net = await balances(ownerId, rows.map((r) => String(r._id)));
  const wallets = rows.map((w) => walletView(w, net.get(String(w._id)) ?? 0));
  const totals: Record<string, number> = {};
  for (const w of wallets) if (!w.archived) totals[w.currency] = (totals[w.currency] ?? 0) + w.balanceMinor;
  return { wallets, totals };
}

export async function getWallet(ownerId: string, id: string) {
  const w = await Wallet.findOne({ _id: id, ownerId }).lean();
  if (!w) throw notFound('Wallet not found');
  return walletView(w, (await balances(ownerId, [id])).get(id) ?? 0);
}

export async function updateWallet(
  ownerId: string, id: string, patch: { name?: string; archived?: boolean; currency?: Currency; openingBalanceMinor?: number }, req: Request,
) {
  const w = await Wallet.findOne({ _id: id, ownerId });
  if (!w) throw notFound('Wallet not found');
  const touchesLedger =
    (patch.currency !== undefined && patch.currency !== w.currency) ||
    (patch.openingBalanceMinor !== undefined && patch.openingBalanceMinor !== w.openingBalanceMinor);
  if (touchesLedger && (await Transaction.exists({ ownerId, walletId: id })))
    throw new AppError(409, 'LEDGER_LOCKED', 'Currency and opening balance cannot change once a wallet has transactions');
  if (patch.name !== undefined) w.name = patch.name;
  if (patch.currency !== undefined) w.currency = patch.currency;
  if (patch.openingBalanceMinor !== undefined) w.openingBalanceMinor = patch.openingBalanceMinor;
  if (patch.archived !== undefined) w.archivedAt = patch.archived ? (w.archivedAt ?? new Date()) : null;
  await w.save();
  await logActivity(ownerId, 'wallet.update', req, { entityType: 'wallet', entityId: id, meta: { fields: Object.keys(patch) } });
  return getWallet(ownerId, id);
}

/* ---------- transactions ---------- */
const txView = (t: any) => ({
  id: String(t._id),
  walletId: String(t.walletId?._id ?? t.walletId), walletName: t.walletId?.name ?? undefined,
  contact: t.contactId ? { id: String(t.contactId._id ?? t.contactId), name: t.contactId.name ?? undefined } : null,
  type: t.type, amountMinor: t.amountMinor, signedAmountMinor: t.type === 'income' ? t.amountMinor : -t.amountMinor,
  currency: t.currency, status: t.status, description: t.description, category: t.category ?? null,
  occurredAt: t.occurredAt, createdAt: t.createdAt,
});

export type TxFilter = { walletId?: string; contactId?: string; type?: string; status?: string; q?: string; from?: Date; to?: Date };

async function filterQuery(ownerId: string, f: TxFilter) {
  const q: Record<string, any> = { ownerId: oid(ownerId) };
  if (f.walletId) q.walletId = oid(f.walletId);
  if (f.contactId) q.contactId = oid(f.contactId);
  if (f.type) q.type = f.type;
  if (f.status) q.status = f.status;
  if (f.from || f.to) q.occurredAt = { ...(f.from && { $gte: f.from }), ...(f.to && { $lte: f.to }) };
  if (f.q) {
    const rx = new RegExp(escapeRx(f.q), 'i');
    const contacts = await Contact.find({ ownerId, name: rx }).select('_id').limit(200).lean();
    q.$or = [{ description: rx }, { category: rx }, ...(contacts.length ? [{ contactId: { $in: contacts.map((c) => c._id) } }] : [])];
  }
  return q;
}

export async function listTransactions(
  ownerId: string, f: TxFilter, o: { sort: 'occurredAt' | 'amountMinor'; order: 'asc' | 'desc'; page: number; limit: number },
) {
  const q = await filterQuery(ownerId, f);
  const dir = o.order === 'asc' ? 1 : -1;
  const [total, rows] = await Promise.all([
    Transaction.countDocuments(q),
    Transaction.find(q).sort({ [o.sort]: dir, _id: dir }).skip((o.page - 1) * o.limit).limit(o.limit)
      .populate('walletId', 'name').populate('contactId', 'name').lean(),
  ]);
  return { items: rows.map(txView), page: o.page, limit: o.limit, total };
}

export async function exportRows(ownerId: string, f: TxFilter, cap = 5000) {
  const rows = await Transaction.find(await filterQuery(ownerId, f)).sort({ occurredAt: -1, _id: -1 }).limit(cap)
    .populate('walletId', 'name').populate('contactId', 'name').lean();
  return rows.map(txView);
}

export async function getTransaction(ownerId: string, id: string) {
  const t = await Transaction.findOne({ _id: id, ownerId }).populate('walletId', 'name').populate('contactId', 'name').lean();
  if (!t) throw notFound('Transaction not found');
  return txView(t);
}

/** Bumps ledgerSeq: two writers on one wallet conflict, so MongoDB serialises them (retried by withTransaction). */
async function lockWallet(ownerId: string, walletId: string, s: ClientSession, requireActive: boolean) {
  const w = await Wallet.findOneAndUpdate(
    { _id: walletId, ownerId, ...(requireActive ? { archivedAt: null } : {}) }, { $inc: { ledgerSeq: 1 } }, { new: true, session: s },
  );
  if (!w) throw new AppError(requireActive ? 409 : 404, requireActive ? 'WALLET_UNAVAILABLE' : 'NOT_FOUND', requireActive ? 'Wallet is archived or does not exist' : 'Wallet not found');
  return w;
}
async function assertFunds(ownerId: string, w: any, amountMinor: number, s: ClientSession) {
  const net = (await balances(ownerId, [String(w._id)], s)).get(String(w._id)) ?? 0;
  if (w.openingBalanceMinor + net < amountMinor) throw new AppError(422, 'INSUFFICIENT_FUNDS', 'This wallet does not have enough balance for that amount');
}

export async function createTransaction(
  ownerId: string,
  input: { walletId: string; type: 'income' | 'expense'; amountMinor: number; status: 'completed' | 'pending'; description?: string; category?: string; contactId?: string; occurredAt?: Date },
  idempotencyKey: string | undefined, req: Request,
) {
  const wallet = await Wallet.findOne({ _id: input.walletId, ownerId }).lean();
  if (!wallet) throw notFound('Wallet not found');
  if (input.contactId && !(await Contact.exists({ _id: input.contactId, ownerId, archivedAt: null }))) throw notFound('Contact not found');

  const replay = async () => {
    const prior = await Transaction.findOne({ ownerId, idempotencyKey }).lean();
    if (!prior) return null;
    if (String(prior.walletId) !== input.walletId || prior.type !== input.type || prior.amountMinor !== input.amountMinor)
      throw new AppError(422, 'IDEMPOTENCY_MISMATCH', 'This Idempotency-Key was already used with a different request');
    return { id: String(prior._id), replayed: true };
  };
  if (idempotencyKey) { const hit = await replay(); if (hit) return hit; }

  const s = await mongoose.startSession();
  try {
    let id = '';
    await s.withTransaction(async () => {
      const w = await lockWallet(ownerId, input.walletId, s, true);
      if (input.status === 'completed' && input.type === 'expense') await assertFunds(ownerId, w, input.amountMinor, s);
      const [t] = await Transaction.create([{
        ownerId, walletId: w._id, contactId: input.contactId, type: input.type, amountMinor: input.amountMinor,
        currency: w.currency, // always the wallet's currency; never client-supplied
        status: input.status, description: input.description ?? '', category: input.category,
        occurredAt: input.occurredAt ?? new Date(), idempotencyKey,
      }], { session: s });
      id = t!.id;
      await logActivity(ownerId, 'transaction.create', req, { entityType: 'transaction', entityId: id, session: s, meta: { type: input.type, amountMinor: input.amountMinor, status: input.status } });
    });
    if (input.status === 'pending')
      await notify(ownerId, 'payment_pending', 'Payment pending', `${input.type === 'expense' ? 'Outgoing' : 'Incoming'} ${formatMinor(input.amountMinor, wallet.currency as Currency)} is waiting to be completed.`);
    return { id, replayed: false };
  } catch (e: any) {
    if (e?.code === 11000 && idempotencyKey) { const hit = await replay(); if (hit) return hit; } // lost a race with an identical request
    throw e;
  } finally { await s.endSession(); }
}

export async function updateTransaction(
  ownerId: string, id: string,
  patch: { description?: string; category?: string | null; contactId?: string | null; status?: 'completed' | 'failed' }, req: Request,
) {
  if (patch.contactId && !(await Contact.exists({ _id: patch.contactId, ownerId, archivedAt: null }))) throw notFound('Contact not found');
  const s = await mongoose.startSession();
  let changed: { status: string; text: string } | null = null;
  try {
    await s.withTransaction(async () => {
      changed = null;
      const t = await Transaction.findOne({ _id: id, ownerId }).session(s);
      if (!t) throw notFound('Transaction not found');
      if (patch.status && patch.status !== t.status) {
        if (t.status !== 'pending') throw new AppError(409, 'INVALID_TRANSITION', 'Only pending transactions can change status');
        const w = await lockWallet(ownerId, String(t.walletId), s, false);
        if (patch.status === 'completed' && t.type === 'expense') await assertFunds(ownerId, w, t.amountMinor, s);
        t.status = patch.status;
        changed = { status: patch.status, text: `${t.type === 'expense' ? 'Outgoing' : 'Incoming'} ${formatMinor(t.amountMinor, t.currency as Currency)}` };
      }
      if (patch.description !== undefined) t.description = patch.description;
      if (patch.category !== undefined) t.category = (patch.category ?? undefined) as any;
      if (patch.contactId !== undefined) t.contactId = (patch.contactId ?? undefined) as any;
      await t.save({ session: s });
      await logActivity(ownerId, 'transaction.update', req, { entityType: 'transaction', entityId: id, session: s, meta: { fields: Object.keys(patch) } });
    });
  } finally { await s.endSession(); }
  const c = changed as { status: string; text: string } | null;
  if (c) await notify(ownerId, `payment_${c.status}`, c.status === 'completed' ? 'Payment completed' : 'Payment failed', `${c.text} was marked ${c.status}.`);
  return getTransaction(ownerId, id);
}
