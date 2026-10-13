import type { Tx } from '@/api/types';
import { useMoney } from '@/api/hooks';
import { Avatar, Skeleton, StatusBadge } from '@/components/ui';
import { fmtDate, fmtTime } from '@/lib/dates';
import { cn } from '@/lib/cn';

export const txName = (t: Tx) => t.contact?.name ?? (t.description || (t.type === 'income' ? 'Received funds' : 'Sent funds'));

export default function TransactionTable({ rows, loading, onSelect, header }: { rows: Tx[]; loading?: boolean; onSelect: (t: Tx) => void; header?: React.ReactNode }) {
  const money = useMoney();
  const empty = !rows.length;
  return (
    <>
      {/* Phones: stacked cards. md+: full table. */}
      <ul className="mt-3 divide-y divide-line md:hidden" aria-label="Transactions">
        {loading && empty ? [0, 1, 2].map((i) => <li key={i} className="py-2"><Skeleton className="h-14" /></li>) : rows.map((t) => (
          <li key={t.id}>
            <button onClick={() => onSelect(t)} className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
              <Avatar name={txName(t)} size={40} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-medium">{txName(t)}</b>
                <small className="block text-mu">{fmtDate(t.occurredAt)} · {fmtTime(t.occurredAt)}</small>
                <small className="mt-0.5 block"><StatusBadge s={t.status} /></small>
              </span>
              <span className={cn('shrink-0 tabular-nums', t.status === 'failed' && 'text-mu line-through')}>{t.signedAmountMinor > 0 ? '+' : ''}{money(t.signedAmountMinor, t.currency)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="mt-3 w-full min-w-[560px] border-collapse text-left">
          <thead><tr className="text-[12px] font-normal text-mu">{header ?? ['Name', 'Date', 'Time', 'Status', 'Amount'].map((h) => <th key={h} scope="col" className="px-2.5 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {loading && empty ? [0, 1, 2].map((i) => <tr key={i}><td colSpan={5} className="px-2.5 py-2"><Skeleton className="h-9" /></td></tr>) : rows.map((t) => (
              <tr key={t.id} tabIndex={0} onClick={() => onSelect(t)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(t))}
                aria-haspopup="dialog" className="group cursor-pointer text-[13.5px] transition hover:bg-canvas focus-visible:bg-canvas">
                <td className="rounded-l-2xl px-2.5 py-2.5"><div className="flex items-center gap-3.5"><Avatar name={txName(t)} /><div><b className="block font-medium">{txName(t)}</b><small className="text-[11px] text-g-dark">{t.walletName}{t.category ? ` · ${t.category}` : ''}</small></div></div></td>
                <td className="px-2.5">{fmtDate(t.occurredAt)}</td>
                <td className="px-2.5">{fmtTime(t.occurredAt)}</td>
                <td className="px-2.5"><StatusBadge s={t.status} /></td>
                <td className={cn('rounded-r-2xl px-2.5 tabular-nums', t.status === 'failed' && 'text-mu line-through')}>{t.signedAmountMinor > 0 ? '+' : ''}{money(t.signedAmountMinor, t.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
