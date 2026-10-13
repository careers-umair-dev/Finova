import { ArrowUpRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivity, useSummary, useTransactions, useWallets } from '@/api/hooks';
import type { Tx } from '@/api/types';
import ActivityChart from '@/components/dashboard/ActivityChart';
import { BalanceCard, PendingCard, PendingList, WalletCard, WeeklyCard } from '@/components/dashboard/Cards';
import TransactionTable from '@/components/dashboard/TransactionTable';
import RangePicker from '@/components/dialogs/RangePicker';
import TransactionDetails from '@/components/dialogs/TransactionDetails';
import TransactionDialog from '@/components/dialogs/TransactionDialog';
import WalletDialog from '@/components/dialogs/WalletDialog';
import { EmptyState, ErrorState, Modal } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { presetRange } from '@/lib/dates';

export default function Dashboard() {
  const { user } = useAuth();
  const wq = useWallets(); const wallets = wq.data?.wallets ?? [];
  const [sel, setSel] = useState<string | undefined>(); const wallet = wallets.find((w) => w.id === sel) ?? wallets[0];
  const [range, setRange] = useState(() => presetRange('60d'));
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [walletOpen, setWalletOpen] = useState(false); const [txType, setTxType] = useState<'income' | 'expense' | null>(null);
  const [detail, setDetail] = useState<Tx | null>(null); const [pendingOpen, setPendingOpen] = useState(false);

  const from = useMemo(() => range.from.toISOString(), [range]); const to = useMemo(() => range.to?.toISOString(), [range]);
  const has = !!wallet; const currency = wallet?.currency;
  const summary = useSummary({ currency, from, to }, has);
  const activity = useActivity({ currency, period }, has);
  const recent = useTransactions({ limit: 5, from, to }, has);
  const pending = useTransactions({ status: 'pending', limit: 100 }, has);
  const pendingInCur = (pending.data?.items ?? []).filter((t) => t.currency === currency);

  const failed = [wq, summary, activity, recent].find((q) => q.isError);
  return (
    <>
      <div className="mb-[22px] mt-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[clamp(30px,4.2vw,50px)] font-medium leading-tight tracking-tight">Welcome Back, <span className="font-normal text-[#9a9a9a]">{user?.name.split(' ')[0]}</span></h1>
        <div className="flex flex-wrap gap-3.5"><RangePicker value={range} onChange={setRange} /><button className="pill" onClick={() => setWalletOpen(true)}><Plus size={18} />Add New Wallet</button></div>
      </div>

      {failed && <ErrorState error={failed.error} onRetry={() => [wq, summary, activity, recent, pending].forEach((q) => q.isError && q.refetch())} />}

      <div className="grid gap-[22px] xl:grid-cols-[minmax(0,1fr)_minmax(0,.62fr)]">
        <div className="stagger grid gap-[22px] lg:grid-cols-[minmax(0,.6fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr]">
          <WalletCard wallets={wallets} selectedId={wallet?.id} onSelect={setSel} onAdd={() => setWalletOpen(true)} loading={wq.isLoading} />
          <ActivityChart data={activity.data} loading={wq.isLoading || activity.isLoading} period={period} onPeriod={setPeriod} error={activity.error} onRetry={() => activity.refetch()} />
          <WeeklyCard s={summary.data} loading={wq.isLoading || (has && summary.isLoading)} />
          <section className="card lg:col-span-2" aria-labelledby="history-title">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="history-title" className="text-base font-medium">Transaction history</h2><p className="mt-0.5 text-[12.5px] text-mu">Recent activity in this date range</p></div>
              <Link to="/history" className="ib !h-11 !w-11" aria-label="View all transactions"><ArrowUpRight size={18} /></Link>
            </div>
            {!wq.isLoading && !has ? <EmptyState title="No transactions yet" text="Add a wallet, then record your first send or receive." /> :
              recent.data && !recent.data.items.length ? <EmptyState title="Nothing in this range" text="Try a wider date range, or record a transaction." /> :
              <TransactionTable rows={recent.data?.items ?? []} loading={wq.isLoading || recent.isLoading} onSelect={setDetail} />}
          </section>
        </div>

        <div className="stagger grid content-start gap-[22px] md:grid-cols-2 xl:grid-cols-1">
          <BalanceCard s={summary.data} loading={wq.isLoading || (has && summary.isLoading)} hasWallets={has} onSend={() => setTxType('expense')} onReceive={() => setTxType('income')} />
          <PendingCard txs={pendingInCur} loading={wq.isLoading || (has && pending.isLoading)} onOpen={() => setPendingOpen(true)} />
        </div>
      </div>

      <WalletDialog open={walletOpen} onOpenChange={setWalletOpen} />
      <TransactionDialog open={!!txType} onOpenChange={(o) => !o && setTxType(null)} type={txType ?? 'expense'} walletId={wallet?.id} />
      <TransactionDetails tx={detail} onClose={() => setDetail(null)} />
      <Modal open={pendingOpen} onOpenChange={setPendingOpen} title="Pending payments" description="Entries still waiting to be completed or failed.">
        <PendingList txs={pendingInCur} onSelect={(t) => { setPendingOpen(false); setDetail(t); }} />
      </Modal>
    </>
  );
}
