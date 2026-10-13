import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCashFlow, useCompare, useMoney, useWallets } from '@/api/hooks';
import type { Cat } from '@/api/types';
import { Badge, EmptyState, ErrorState, Select, Skeleton } from '@/components/ui';
import { apiUrl, qs } from '@/lib/api';
import { PRESETS, presetRange } from '@/lib/dates';

const Pct = ({ v, invert }: { v: number | null; invert?: boolean }) => v === null ? <Badge tone="gray">no prior data</Badge> : <Badge tone={(v >= 0) !== !!invert ? 'green' : 'red'}>{v > 0 ? '+' : ''}{v}% vs previous period</Badge>;
const Breakdown = ({ title, rows, cur }: { title: string; rows: Cat[]; cur: string }) => {
  const money = useMoney();
  return (
    <section className="card"><h2 className="font-medium">{title}</h2>
      {rows.length ? <ul className="mt-4 space-y-3">{rows.map((r) => (
        <li key={r.category}><div className="flex justify-between text-[13.5px]"><span>{r.category} <span className="text-mu">· {r.count}</span></span><span className="tabular-nums">{money(r.amountMinor, cur)} <span className="text-mu">({r.sharePct}%)</span></span></div>
          <div className="mt-1 h-2 rounded-full bg-canvas" role="presentation"><div className="h-2 rounded-full bg-g" style={{ width: `${r.sharePct}%` }} /></div></li>))}</ul> : <p className="mt-4 text-mu">Nothing in this range.</p>}
    </section>
  );
};

export default function Reports() {
  const money = useMoney(); const wallets = useWallets().data?.wallets ?? [];
  const currencies = [...new Set(wallets.map((w) => w.currency))]; const [cur, setCur] = useState<string>(); const currency = cur ?? currencies[0];
  const [key, setKey] = useState('90d'); const range = useMemo(() => presetRange(key), [key]);
  const p = { currency, from: range.from.toISOString(), to: range.to?.toISOString() };
  const cash = useCashFlow(p, !!currency); const cmp = useCompare({ currency }, !!currency);
  const c = cash.data;
  const bars = (c?.series ?? []).map((s) => ({ month: s.month, Income: s.incomeMinor / 100, Expense: s.expenseMinor / 100 }));
  const lines = (cmp.data?.months ?? []).map((m) => ({ month: m.month, 'This year': m.thisYear.netMinor / 100, 'Last year': m.lastYear.netMinor / 100 }));
  const tip = (v: unknown) => money(Math.round(Number(v) * 100), currency ?? 'USD');

  if (wallets.length === 0) return <section className="card"><EmptyState title="No data to report yet" text="Create a wallet and record some transactions to see cash-flow reports." /></section>;
  return (
    <div className="space-y-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[clamp(28px,3.4vw,40px)] font-medium tracking-tight">Reports</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select aria-label="Currency" className="!w-28" value={currency ?? ''} onChange={(e) => setCur(e.target.value)}>{currencies.map((x) => <option key={x}>{x}</option>)}</Select>
          <Select aria-label="Date range" className="!w-44" value={key} onChange={(e) => setKey(e.target.value)}>{PRESETS.filter((x) => x.key !== '7d').map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
          <a className="pill !h-12" download href={apiUrl(`/reports/cash-flow.csv${qs({ ...p, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}`)}><Download size={16} />Export CSV</a>
        </div>
      </div>
      {cash.isError ? <ErrorState error={cash.error} onRetry={() => cash.refetch()} /> : !c || cash.isLoading ? <Skeleton className="h-64" /> : !c.hasData ? <section className="card"><EmptyState title="No completed transactions in this range" text="Pick a longer range or record a transaction." /></section> : (
        <>
          <div className="grid gap-[22px] md:grid-cols-3">
            {([['Income', c.totals.incomeMinor, c.change.incomePct, false], ['Expenses', c.totals.expenseMinor, c.change.expensePct, true], ['Net cash flow', c.totals.netMinor, c.change.netPct, false]] as const).map(([label, v, pct, inv]) => (
              <section key={label} className="card"><p className="text-mu">{label}</p><p className="my-2 text-[34px] tracking-tight">{money(v, c.currency)}</p><Pct v={pct} invert={inv} /></section>
            ))}
          </div>
          <section className="card" aria-label="Income and expenses by month">
            <h2 className="font-medium">Income vs expenses</h2>
            <div className="mt-4 h-72" role="img" aria-label={`Monthly income and expenses in ${c.currency}`}>
              <ResponsiveContainer width="100%" height="100%"><BarChart data={bars}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e2" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={56} /><Tooltip formatter={tip} /><Legend /><Bar dataKey="Income" fill="#07865b" radius={[8, 8, 0, 0]} /><Bar dataKey="Expense" fill="#b8dccb" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
          </section>
          <div className="grid gap-[22px] lg:grid-cols-2"><Breakdown title="Income by category" rows={c.breakdown.income} cur={c.currency} /><Breakdown title="Expenses by category" rows={c.breakdown.expense} cur={c.currency} /></div>
          <div className="grid gap-[22px] lg:grid-cols-2">
            <section className="card"><h2 className="font-medium">Top counterparties</h2>
              {c.topCounterparties.length ? <ul className="mt-4 divide-y divide-line">{c.topCounterparties.map((t) => <li key={t.contactId} className="flex justify-between py-2.5"><span>{t.name} <span className="text-mu">· {t.count}</span></span><span className="tabular-nums">{money(t.volumeMinor, c.currency)}</span></li>)}</ul> : <p className="mt-4 text-mu">Link transactions to contacts to see them here.</p>}
            </section>
            <section className="card"><h2 className="font-medium">Entries by status</h2>
              <ul className="mt-4 divide-y divide-line">{Object.entries(c.statusCounts).map(([k, n]) => <li key={k} className="flex justify-between py-2.5 capitalize"><span>{k}</span><span>{n}</span></li>)}</ul>
            </section>
          </div>
        </>
      )}
      {cmp.data?.hasData && (
        <section className="card" aria-label="This year compared with last year">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">Net cash flow: {cmp.data.year} vs {cmp.data.year - 1}</h2><Pct v={cmp.data.totals.netChangePct} /></div>
          <div className="mt-4 h-72" role="img" aria-label="Monthly net cash flow, this year versus last year">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={lines}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e2" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={56} /><Tooltip formatter={tip} /><Legend /><Line type="monotone" dataKey="This year" stroke="#07865b" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="Last year" stroke="#8fc2aa" strokeWidth={2} strokeDasharray="5 4" dot={false} /></LineChart></ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
