import { ArrowDownUp, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransactions, useWallets } from '@/api/hooks';
import type { Tx } from '@/api/types';
import Pager from '@/components/Pager';
import TransactionTable from '@/components/dashboard/TransactionTable';
import TransactionDetails from '@/components/dialogs/TransactionDetails';
import { EmptyState, ErrorState, Select } from '@/components/ui';
import { apiUrl, qs } from '@/lib/api';
import { dayEnd, dayStart } from '@/lib/dates';

export default function History() {
  const [sp, setSp] = useSearchParams(); const get = (k: string) => sp.get(k) ?? '';
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!('page' in patch)) n.delete('page');
    setSp(n, { replace: true });
  };
  const [q, setQ] = useState(get('q'));
  useEffect(() => { const t = setTimeout(() => q !== get('q') && set({ q }), 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const wallets = useWallets(true).data?.wallets ?? []; const [detail, setDetail] = useState<Tx | null>(null);

  const filters = { q: get('q') || undefined, status: get('status') || undefined, type: get('type') || undefined, walletId: get('walletId') || undefined, contactId: get('contactId') || undefined, from: dayStart(get('from')), to: dayEnd(get('to')), sort: get('sort') || 'occurredAt', order: get('order') || 'desc' };
  const page = Number(get('page')) || 1;
  const data = useTransactions({ ...filters, page, limit: 20 });
  const sort = (key: 'occurredAt' | 'amountMinor') => set({ sort: key, order: filters.sort === key && filters.order === 'desc' ? 'asc' : 'desc' });
  const sortTh = (k: 'occurredAt' | 'amountMinor', label: string) => (
    <th scope="col" aria-sort={filters.sort === k ? (filters.order === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-2.5 py-2 font-normal">
      <button onClick={() => sort(k)} className="inline-flex items-center gap-1 hover:text-ink">{label}<ArrowDownUp size={12} aria-hidden /></button>
    </th>
  );
  const th = (t: string) => <th scope="col" className="px-2.5 py-2 font-normal">{t}</th>;
  const exportHref = apiUrl(`/transactions/export.csv${qs(filters)}`);

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-medium">History</h1><p className="text-mu">Every ledger entry, with search, filters and export.</p></div>
        <a href={exportHref} className="pill !h-11" download><Download size={16} />Export CSV</a>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input className="input lg:col-span-2" type="search" placeholder="Search description, category, counterparty…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        <Select aria-label="Status" value={get('status')} onChange={(e) => set({ status: e.target.value })}><option value="">All statuses</option><option value="completed">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></Select>
        <Select aria-label="Type" value={get('type')} onChange={(e) => set({ type: e.target.value })}><option value="">Sent & received</option><option value="income">Received</option><option value="expense">Sent</option></Select>
        <Select aria-label="Wallet" value={get('walletId')} onChange={(e) => set({ walletId: e.target.value })}><option value="">All wallets</option>{wallets.map((w) => <option key={w.id} value={w.id}>{w.name}{w.archived ? ' (archived)' : ''}</option>)}</Select>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2">
          <input type="date" className="input" aria-label="From date" value={get('from')} max={get('to') || undefined} onChange={(e) => set({ from: e.target.value })} />
          <input type="date" className="input" aria-label="To date" value={get('to')} min={get('from') || undefined} onChange={(e) => set({ to: e.target.value })} />
        </div>
      </div>
      <div className="mt-3 md:hidden">
        <Select aria-label="Sort by" value={`${filters.sort}:${filters.order}`} onChange={(e) => { const [sortKey, order] = e.target.value.split(':'); set({ sort: sortKey!, order: order! }); }}>
          <option value="occurredAt:desc">Newest first</option><option value="occurredAt:asc">Oldest first</option>
          <option value="amountMinor:desc">Highest amount</option><option value="amountMinor:asc">Lowest amount</option>
        </Select>
      </div>
      {data.isError && <ErrorState error={data.error} onRetry={() => data.refetch()} />}
      {get('contactId') && <button className="mt-3 rounded-full bg-g-soft px-3 py-1.5 text-[13px] text-g-dark" onClick={() => set({ contactId: '' })}>Filtered to one contact ✕</button>}
      {data.data && !data.data.items.length ? <EmptyState title="No matching transactions" text="Adjust your filters or record a new transaction from the dashboard." /> : (
        <TransactionTable rows={data.data?.items ?? []} loading={data.isLoading} onSelect={setDetail} header={<>{th('Name')}{sortTh('occurredAt', 'Date')}{th('Time')}{th('Status')}{sortTh('amountMinor', 'Amount')}</>} />
      )}
      {data.data && data.data.total > 0 && <Pager page={page} limit={20} total={data.data.total} onPage={(p) => set({ page: String(p) })} />}
      <TransactionDetails tx={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
