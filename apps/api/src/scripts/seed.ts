// Development-only demo data. Refuses to run in production. Every name here is fictional.
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Contact } from '../models/Contact.js';
import { DocumentModel } from '../models/Document.js';
import { Notification } from '../models/Notification.js';
import { Session } from '../models/Session.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { UserPreferences } from '../models/UserPreferences.js';
import { Wallet } from '../models/Wallet.js';

if (env.NODE_ENV === 'production') { console.error('Refusing to seed demo data in production.'); process.exit(1); }
await mongoose.connect(env.MONGODB_URI);

const EMAIL = 'demo@finova.local';
const old = await User.findOne({ email: EMAIL });
if (old) {
  const ownerId = old._id;
  await Promise.all([Wallet, Transaction, Contact, DocumentModel, Notification, ActivityLog, UserPreferences].map((m: any) => m.deleteMany({ ownerId })));
  await Session.deleteMany({ userId: ownerId }); await User.deleteOne({ _id: ownerId });
}

const password = randomBytes(9).toString('base64url'); // random per run; printed once, never committed
const user = await User.create({ name: 'Umair Demo', email: EMAIL, passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: new Date() });
const ownerId = user._id;
await UserPreferences.create({ ownerId });

const wallets = await Wallet.insertMany([
  { ownerId, name: 'Main wallet', currency: 'USD', openingBalanceMinor: 4_500_000, displayCode: '9090' },
  { ownerId, name: 'Savings', currency: 'USD', openingBalanceMinor: 1_200_000, displayCode: '4417' },
  { ownerId, name: 'Studio (EUR)', currency: 'EUR', openingBalanceMinor: 800_000, displayCode: '2203' },
]);
const contacts = await Contact.insertMany(
  ['Northwind Design', 'Pay Cloud', 'Harbor Supplies', 'Lakeside Studio', 'Orbit Labs'].map((name) => ({ ownerId, name, email: `billing@${name.toLowerCase().replace(/\W+/g, '')}.example` })),
);

let seedN = 7; const rnd = () => ((seedN = (seedN * 1664525 + 1013904223) % 4294967296) / 4294967296); // deterministic
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const incomeDesc = ['Design retainer', 'Invoice payment', 'Consulting fee', 'Subscription payout'];
const expenseDesc = ['Software licences', 'Office supplies', 'Contractor payment', 'Travel', 'Hosting'];
const perMonth = [14, 5, 8];
const now = new Date(); const draft: any[] = [];
for (let m = 5; m >= 0; m--) wallets.forEach((w, wi) => {
  for (let i = 0; i < perMonth[wi]!; i++) {
    const day = m === 0 ? 1 + Math.floor(rnd() * Math.max(1, now.getDate() - 1)) : 1 + Math.floor(rnd() * 27);
    const occurredAt = new Date(now.getFullYear(), now.getMonth() - m, day, 8 + Math.floor(rnd() * 12), Math.floor(rnd() * 60));
    const income = rnd() < 0.58; const roll = rnd();
    draft.push({
      ownerId, walletId: w._id, contactId: pick(contacts)._id, currency: w.currency, occurredAt,
      type: income ? 'income' : 'expense', amountMinor: Math.round((income ? 80 + rnd() * 4100 : 15 + rnd() * 1400) * 100),
      status: m === 0 && roll > 0.9 ? 'pending' : roll < 0.04 ? 'failed' : 'completed',
      description: pick(income ? incomeDesc : expenseDesc), category: income ? 'Income' : pick(['Software', 'Office', 'Services', 'Travel']),
    });
  }
});
// Replay chronologically; flip any expense that would overdraw a wallet so seeded data obeys the same rule as the API.
draft.sort((a, b) => +a.occurredAt - +b.occurredAt);
const run = new Map(wallets.map((w) => [String(w._id), w.openingBalanceMinor]));
for (const t of draft) {
  if (t.status !== 'completed') continue;
  const k = String(t.walletId); const cur = run.get(k)!;
  if (t.type === 'expense' && cur < t.amountMinor) t.type = 'income';
  run.set(k, cur + (t.type === 'income' ? t.amountMinor : -t.amountMinor));
}
await Transaction.insertMany(draft);

await Notification.insertMany([
  { ownerId, type: 'welcome', title: 'Welcome to Finova', body: 'This account holds demo data for local development.' },
  { ownerId, type: 'pending', title: 'Pending payments need review', body: 'Some recent transactions are still pending.' },
  { ownerId, type: 'summary', title: 'Your weekly summary is ready', body: 'Open Reports to see this week’s cash flow.' },
]);
// Metadata only — there are no real files behind these keys, so preview/download will 404 until object storage is wired up.
await DocumentModel.insertMany([
  { ownerId, name: 'Sample invoice (demo)', category: 'invoice', mimeType: 'application/pdf', sizeBytes: 0, storageKey: 'seed/sample-invoice' },
  { ownerId, name: 'Sample statement (demo)', category: 'statement', mimeType: 'application/pdf', sizeBytes: 0, storageKey: 'seed/sample-statement' },
]);

console.log(`Seeded ${draft.length} transactions across ${wallets.length} wallets.\n  email:    ${EMAIL}\n  password: ${password}   (random; generated for this run only)`);
await mongoose.disconnect();
