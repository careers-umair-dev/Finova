import { useState } from 'react';
import { useMarkRead, useNotifications } from '@/api/hooks';
import Pager from '@/components/Pager';
import { EmptyState, ErrorState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fmtDate, fmtTime } from '@/lib/dates';

export default function Notifications() {
  const [page, setPage] = useState(1); const [unread, setUnread] = useState(false);
  const q = useNotifications({ page, limit: 20, unreadOnly: unread }); const mark = useMarkRead();
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-medium">Notifications</h1><p className="text-mu">{q.data ? `${q.data.unreadCount} unread` : ' '}</p></div>
        <button className="pill !h-11" disabled={!q.data?.unreadCount} onClick={() => mark.mutate(undefined)}>Mark all read</button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-mu"><input type="checkbox" checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} />Unread only</label>
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && !q.data.items.length ? <EmptyState title="You're all caught up" text="Updates about your payments will appear here." /> : (
        <ul className="mt-3 divide-y divide-line">{q.data?.items.map((n) => (
          <li key={n.id}><button onClick={() => !n.read && mark.mutate(n.id)} className="flex w-full items-start gap-3 rounded-2xl px-2 py-3.5 text-left hover:bg-canvas">
            <span aria-hidden className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-g')} />
            <span className="flex-1"><b className={cn('block', n.read ? 'font-normal' : 'font-medium')}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</b>{n.body && <span className="text-mu">{n.body}</span>}</span>
            <time className="shrink-0 text-[12px] text-mu" dateTime={n.createdAt}>{fmtDate(n.createdAt)} · {fmtTime(n.createdAt)}</time>
          </button></li>))}</ul>
      )}
      {q.data && q.data.total > 0 && <Pager page={page} limit={20} total={q.data.total} onPage={setPage} />}
    </section>
  );
}
