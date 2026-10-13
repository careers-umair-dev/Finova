import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errMsg, useMoney, useUpdateWallet, useWallets } from '@/api/hooks';
import type { Wallet } from '@/api/types';
import WalletDialog from '@/components/dialogs/WalletDialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useToast } from '@/lib/toast';

export default function Wallets() {
  const [archived, setArchived] = useState(false); const q = useWallets(archived); const money = useMoney(); const update = useUpdateWallet(); const toast = useToast();
  const [edit, setEdit] = useState<Wallet | undefined>(); const [open, setOpen] = useState(false);
  const wallets = q.data?.wallets ?? [];
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-medium">Wallets</h1><p className="text-mu">Ledger accounts inside Finova. Balances are calculated from completed transactions.</p></div>
        <button className="btn-primary" onClick={() => { setEdit(undefined); setOpen(true); }}><Plus size={16} />Add wallet</button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-mu"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />Show archived</label>
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <Skeleton className="mt-5 h-40" /> : !wallets.length ? <EmptyState title="No wallets yet" text="Create your first wallet to start recording transactions." action={<button className="btn-primary" onClick={() => setOpen(true)}>Add wallet</button>} /> : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{wallets.map((w) => (
          <li key={w.id} className="rounded-3xl bg-canvas p-5">
            <div className="flex items-start justify-between"><div><b className="text-base font-medium">{w.name}</b><p className="text-[12.5px] text-mu">{w.currency} · •••• {w.displayCode}</p></div>{w.archived && <Badge tone="gray">Archived</Badge>}</div>
            <p className="my-4 text-[28px] tracking-tight">{money(w.balanceMinor, w.currency)}</p>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <Link to={`/history?walletId=${w.id}`} className="rounded-full bg-white px-3.5 py-2 hover:bg-neutral-50">Transactions</Link>
              <button className="rounded-full bg-white px-3.5 py-2 hover:bg-neutral-50" onClick={() => { setEdit(w); setOpen(true); }}>Edit</button>
              <button className="rounded-full bg-white px-3.5 py-2 hover:bg-neutral-50" onClick={async () => { try { await update.mutateAsync({ id: w.id, archived: !w.archived }); toast(w.archived ? 'Wallet restored' : 'Wallet archived'); } catch (e) { toast(errMsg(e), 'error'); } }}>{w.archived ? 'Restore' : 'Archive'}</button>
            </div>
          </li>))}</ul>
      )}
      <WalletDialog open={open} onOpenChange={setOpen} wallet={edit} />
    </section>
  );
}
