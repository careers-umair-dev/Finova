import { ArrowUpRight, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMoney } from '@/api/hooks';
import type { Activity } from '@/api/types';
import { EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { compactMinor } from '@/lib/money';

/** 1/2/2.5/5 × 10^n step so the top gridline is a round number. */
export function niceStep(rough: number) {
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  return ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag);
}

export default function ActivityChart({ data, loading, period, onPeriod, error, onRetry }: { data?: Activity; loading: boolean; period: 'monthly' | 'annual'; onPeriod: (p: 'monthly' | 'annual') => void; error?: unknown; onRetry?: () => void }) {
  const money = useMoney(); const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [period, data?.currency]);
  const buckets = data?.buckets ?? []; const idx = sel ?? data?.peakIndex ?? null;
  const step = niceStep(Math.max(1, ...buckets.map((b) => Math.max(b.netMinor, 0))) / 5); const top = step * 5;
  const cur = data?.currency ?? 'USD';
  return (
    <section className="card flex flex-col lg:col-start-2 lg:row-span-2" aria-labelledby="activity-title" aria-busy={loading && !data}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5"><span className="ib"><BarChart3 size={20} /></span><h2 id="activity-title" className="font-medium">Cash flow</h2></div>
        <div className="flex items-center gap-2.5">
          <Segmented label="Period" value={period} onChange={onPeriod} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annually' }]} />
          <Link to="/reports" className="ib" aria-label="Open reports"><ArrowUpRight size={18} /></Link>
        </div>
      </div>
      {error && !data ? <ErrorState error={error} onRetry={onRetry} /> : loading && !data ? <Skeleton className="mt-5 min-h-[300px] flex-1" /> : !data?.hasData ? (
        <EmptyState title="No activity yet" text="Completed transactions will show up here as monthly bars." />
      ) : (
        <div className="relative mt-5 min-h-[300px] flex-1 pl-9" role="group" aria-label={`Net cash flow, ${period === 'monthly' ? 'last 6 months' : 'last 6 years'}, in ${cur}`}>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div key={k} aria-hidden>
              <div className="absolute left-9 right-0 border-t border-dashed border-[#e4e4e2]" style={{ top: `calc((100% - 26px) * ${1 - k / 5})` }} />
              <span className="absolute left-0 -translate-y-1/2 text-[11px] text-mu" style={{ top: `calc((100% - 26px) * ${1 - k / 5})` }}>{k ? compactMinor(step * k) : '0'}</span>
            </div>
          ))}
          <div className="absolute bottom-[26px] left-9 right-0 top-0 flex items-end justify-between px-1.5">
            {buckets.map((b, i) => {
              const on = i === idx; const h = Math.max(0, b.netMinor) / top * 100;
              return (
                <div key={b.key} className="relative flex h-full w-[15%] flex-col items-center justify-end">
                  {on && (
                    <motion.div className="absolute flex flex-col items-center" style={{ bottom: `calc(${h}% + 6px)` }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.2 }}>
                      <span className="whitespace-nowrap rounded-xl bg-g px-2 py-1 text-[10px] text-white">{b.changePct === null ? money(b.netMinor, cur) : `${b.changePct > 0 ? '+' : ''}${b.changePct}%`}</span>
                      <i className="mt-1 h-3 w-3 rounded-full border-[3px] border-g bg-white" />
                    </motion.div>
                  )}
                  <motion.button onClick={() => setSel(i)} aria-pressed={on} aria-label={`${b.label}: net ${money(b.netMinor, cur)}`} title={`${b.label}: ${money(b.netMinor, cur)}`}
                    initial={{ height: '0%' }} animate={{ height: `${Math.max(h, b.netMinor > 0 ? 3 : 0.8)}%` }} transition={{ duration: 0.6, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                    className={cn('w-full rounded-full transition-colors', on ? 'bg-g' : 'bg-mint/90 hover:bg-mint')} style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 2px, transparent 2px 5px)' }} />
                </div>
              );
            })}
          </div>
          <div aria-hidden className="absolute bottom-0 left-9 right-0 flex justify-between px-1.5">{buckets.map((b) => <span key={b.key} className="w-[15%] text-center text-[11px] text-mu">{b.label}</span>)}</div>
          <table className="sr-only"><caption>Net cash flow by {period === 'monthly' ? 'month' : 'year'}</caption><thead><tr><th>Period</th><th>Income</th><th>Expense</th><th>Net</th></tr></thead>
            <tbody>{buckets.map((b) => <tr key={b.key}><td>{b.label}</td><td>{money(b.incomeMinor, cur)}</td><td>{money(b.expenseMinor, cur)}</td><td>{money(b.netMinor, cur)}</td></tr>)}</tbody></table>
        </div>
      )}
    </section>
  );
}
