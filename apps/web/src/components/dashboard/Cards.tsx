import { ArrowDown, ArrowUp, ArrowUpRight, ChevronLeft, ChevronRight, CreditCard, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMoney } from '@/api/hooks';
import type { Summary, Tx, Wallet } from '@/api/types';
import { Avatar, Badge, CardHead, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/dates';
import { splitMoney } from '@/lib/money';
import { txName } from './TransactionTable';

const pct = (n: number | null) => (n === null ? null : `${n > 0 ? '+' : ''}${n}%`);
const OpenLink = ({ to, label }: { to: string; label: string }) => <Link to={to} className="ib !h-11 !w-11" aria-label={label}><ArrowUpRight size={18} /></Link>;

export function WalletCard({ wallets, selectedId, onSelect, onAdd, loading }: { wallets: Wallet[]; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void; loading: boolean }) {
  const money = useMoney(); const i = Math.max(0, wallets.findIndex((w) => w.id === selectedId)); const w = wallets[i];
  const step = (d: number) => onSelect(wallets[(i + d + wallets.length) % wallets.length]!.id);
  return (
    <section className="card" aria-label="Wallet">
      <CardHead title="Wallet" sub="Current balance" action={<OpenLink to="/wallets" label="Manage wallets" />} />
      {loading ? <Skeleton className="mt-5 h-[196px] !rounded-3xl" /> : !w ? (
        <EmptyState title="No wallets yet" text="Create a wallet to start tracking your balance." action={<button className="btn-primary" onClick={onAdd}><Plus size={16} />Add wallet</button>} />
      ) : (
        <div className="relative mt-5 flex h-[196px] flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a8f62] to-[#066b49] p-[22px] pb-[18px] text-white">
          <span aria-hidden className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/[.07]" />
          <div className="flex items-start justify-between">
            <div><b className="text-[19px] font-semibold italic tracking-wider">FINOVA</b><p className="mt-1.5 text-xs opacity-85">{w.name} · {w.currency}</p></div>
            {wallets.length > 1 && (
              <div className="relative z-10 flex gap-1">
                <button onClick={() => step(-1)} aria-label="Previous wallet" className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronLeft size={16} /></button>
                <button onClick={() => step(1)} aria-label="Next wallet" className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
          <p className="my-auto text-[38px] leading-none tracking-tight" aria-label={`Balance ${money(w.balanceMinor, w.currency)}`}>{money(w.balanceMinor, w.currency)}</p>
          <div className="flex justify-between text-xs opacity-90"><span>•••• {w.displayCode}</span><span>Opened {new Date(w.createdAt).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })}</span></div>
        </div>
      )}
    </section>
  );
}

export function WeeklyCard({ s, loading }: { s?: Summary; loading: boolean }) {
  const money = useMoney(); const c = s?.weeklyIncome.changePct ?? null;
  return (
    <section className="card flex items-center justify-between" aria-label="Weekly income">
      {loading || !s ? <Skeleton className="h-12 w-full" /> : (
        <>
          <div><small className="text-xs text-mu">Weekly income</small><p className="mt-0.5 text-[30px] leading-tight">{money(s.weeklyIncome.amountMinor, s.currency)}</p></div>
          {c !== null ? <Badge tone={c >= 0 ? 'green' : 'red'}>{pct(c)}</Badge> : <Badge tone="gray">No prior week</Badge>}
        </>
      )}
    </section>
  );
}

function trendPath(points: number[], w = 360, h = 130) {
  if (points.length < 2) return { line: `M0,${h / 2} L${w},${h / 2}`, area: '' };
  const lo = Math.min(...points), hi = Math.max(...points), span = hi - lo || 1;
  const P = points.map((v, i) => [(i * w) / (points.length - 1), h - 8 - ((v - lo) / span) * (h - 24)] as const);
  let d = `M${P[0]![0]},${P[0]![1]}`;
  for (let i = 0; i < P.length - 1; i++) { const [a, b] = [P[i]!, P[i + 1]!], cx = (a[0] + b[0]) / 2; d += ` C${cx},${a[1]} ${cx},${b[1]} ${b[0]},${b[1]}`; }
  return { line: d, area: `${d} L${w},${h} L0,${h}Z` };
}

export function BalanceCard({ s, loading, hasWallets, onSend, onReceive }: { s?: Summary; loading: boolean; hasWallets: boolean; onSend: () => void; onReceive: () => void }) {
  const parts = s ? splitMoney(s.balanceMinor, s.currency) : null; const t = trendPath(s?.trend.map((p) => p.balanceMinor) ?? []);
  return (
    <section className="card overflow-hidden pb-5 text-center" aria-label="Balance">
      <div className="text-left"><CardHead title="Balance" sub={s ? `All ${s.currency} wallets` : 'All wallets'} action={<OpenLink to="/reports" label="Open reports" />} /></div>
      <small className="mt-5 block text-xs text-mu">Total balance</small>
      {loading || !parts ? <Skeleton className="mx-auto mt-2 h-10 w-48" /> : <p className="text-[38px] tracking-tight">{parts.main}<span className="text-mu">{parts.frac}</span></p>}
      <div className="-mx-6 mt-1.5 h-[130px]">
        <svg viewBox="0 0 360 130" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Balance trend over the selected date range">
          <defs><linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07865b" stopOpacity=".28" /><stop offset="1" stopColor="#07865b" stopOpacity="0" /></linearGradient></defs>
          {t.area && <path d={t.area} fill="url(#bal-fill)" />}
          <path d={t.line} fill="none" stroke="#2f9b73" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="-mt-3 inline-flex rounded-full bg-canvas">
        <button onClick={onSend} disabled={!hasWallets} className="flex items-center gap-2 rounded-full bg-g px-6 py-3 text-[13px] text-white transition hover:bg-g-dark disabled:opacity-50">Send <ArrowUp size={14} /></button>
        <button onClick={onReceive} disabled={!hasWallets} className="flex items-center gap-2 rounded-full px-6 py-3 text-[13px] text-mu transition hover:text-ink disabled:opacity-50">Receive <ArrowDown size={14} /></button>
      </div>
    </section>
  );
}

/** Real data: pending ledger entries in the selected currency (nothing is "credit" or "refunds" — Finova doesn't issue either). */
export function PendingCard({ txs, loading, onOpen }: { txs: Tx[]; loading: boolean; onOpen: () => void }) {
  const money = useMoney(); const cur = txs[0]?.currency;
  const out = txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amountMinor, 0);
  const people = [...new Map(txs.filter((t) => t.contact?.name).map((t) => [t.contact!.id, t.contact!.name!])).values()];
  const parts = cur ? splitMoney(out, cur) : null;
  return (
    <section className="card flex flex-1 flex-col" aria-label="Pending payments">
      <div className="flex items-center gap-3.5"><span className="ib"><CreditCard size={20} /></span><div><h2 className="text-base font-medium">Pending payments</h2><p className="text-[12.5px] text-mu">Outgoing, awaiting completion</p></div></div>
      {loading ? <Skeleton className="my-8 h-12" /> : (
        <p className="my-7 flex items-center gap-3 text-[42px] tracking-tight">
          {parts ? <>{parts.main}<span className="text-mu">{parts.frac}</span></> : <span className="text-mu">{money(0, 'USD')}</span>}
          <Badge tone={txs.length ? 'amber' : 'gray'}>{txs.length} pending</Badge>
        </p>
      )}
      <div className="mt-auto rounded-3xl bg-canvas p-5">
        <CardHead title="Involving" sub={people.length ? 'People on pending entries' : 'No pending entries'} action={<button className="ib !h-11 !w-11 !bg-white" aria-label="View pending payments" onClick={onOpen}><ArrowUpRight size={18} /></button>} />
        <div className="mt-4 flex items-center">
          {people.slice(0, 4).map((n) => <span key={n} className="-mr-1.5 rounded-full border-[3px] border-white"><Avatar name={n} size={36} /></span>)}
          {people.length > 4 && <button onClick={onOpen} aria-label={`${people.length - 4} more`} className="ml-2 grid h-12 w-12 place-items-center rounded-full bg-g text-[13px] text-white">+{people.length - 4}</button>}
        </div>
      </div>
    </section>
  );
}

export const PendingList = ({ txs, onSelect }: { txs: Tx[]; onSelect: (t: Tx) => void }) => {
  const money = useMoney();
  return txs.length ? (
    <ul className="divide-y divide-line">
      {txs.map((t) => (
        <li key={t.id}><button onClick={() => onSelect(t)} className={cn('flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-canvas')}>
          <span><b className="block font-medium">{txName(t)}</b><small className="text-mu">{fmtDate(t.occurredAt)}</small></span>
          <span className="tabular-nums">{money(t.signedAmountMinor, t.currency)}</span>
        </button></li>
      ))}
    </ul>
  ) : <p className="py-6 text-center text-mu">Nothing is pending.</p>;
};
