import { useState } from 'react';
import { errMsg, useMoney, usePatchTransaction } from '@/api/hooks';
import type { Tx } from '@/api/types';
import { FormError, Modal, StatusBadge } from '@/components/ui';
import { fmtDate, fmtTime } from '@/lib/dates';
import { useToast } from '@/lib/toast';

export default function TransactionDetails({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const money = useMoney(); const patch = usePatchTransaction(); const toast = useToast(); const [err, setErr] = useState<string | null>(null);
  const act = async (status: 'completed' | 'failed') => {
    if (!tx) return; setErr(null);
    try { await patch.mutateAsync({ id: tx.id, status }); toast(status === 'completed' ? 'Marked completed' : 'Marked failed'); onClose(); } catch (e) { setErr(errMsg(e)); }
  };
  const rows: [string, React.ReactNode][] = tx ? [
    ['Counterparty', tx.contact?.name ?? '—'], ['Wallet', tx.walletName ?? '—'], ['Type', tx.type === 'income' ? 'Received' : 'Sent'],
    ['Date', `${fmtDate(tx.occurredAt)} · ${fmtTime(tx.occurredAt)}`], ['Status', <StatusBadge key="s" s={tx.status} />],
    ['Category', tx.category ?? '—'], ['Description', tx.description || '—'], ['Reference', <code key="r" className="text-xs">{tx.id}</code>],
  ] : [];
  return (
    <Modal open={!!tx} onOpenChange={(o) => { if (!o) { setErr(null); onClose(); } }} title={tx ? money(tx.signedAmountMinor, tx.currency) : 'Transaction'} description="Internal ledger entry. Amount, wallet and date can't be edited, to keep history auditable.">
      <dl className="divide-y divide-line">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-mu">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl>
      <div className="mt-4 space-y-3">
        <FormError msg={err} />
        {tx?.status === 'pending' && (
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={patch.isPending} onClick={() => act('completed')}>Mark completed</button>
            <button className="pill !h-12 flex-1 justify-center !bg-neutral-100" disabled={patch.isPending} onClick={() => act('failed')}>Mark failed</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
