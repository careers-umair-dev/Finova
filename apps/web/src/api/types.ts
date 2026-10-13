import type { Currency } from '@/lib/money';
export type User = { id: string; name: string; email: string; emailVerified: boolean; createdAt: string };
export type Wallet = { id: string; name: string; currency: Currency; openingBalanceMinor: number; balanceMinor: number; displayCode: string; archived: boolean; createdAt: string };
export type TxStatus = 'completed' | 'pending' | 'failed';
export type Tx = {
  id: string; walletId: string; walletName?: string; contact: { id: string; name?: string } | null; type: 'income' | 'expense';
  amountMinor: number; signedAmountMinor: number; currency: Currency; status: TxStatus; description: string; category: string | null; occurredAt: string; createdAt: string;
};
export type Page<T> = { items: T[]; page: number; limit: number; total: number };
export type Contact = { id: string; name: string; email: string | null; phone: string | null; notes: string | null; archived: boolean; createdAt: string };
export type ContactDetail = { contact: Contact; stats: { byCurrency: Record<string, { incomeMinor: number; expenseMinor: number; count: number }>; lastActivityAt: string | null } };
export type Doc = { id: string; name: string; category: 'invoice' | 'receipt' | 'statement' | 'contract' | 'other'; mimeType: string; sizeBytes: number; createdAt: string };
export type Notice = { id: string; type: string; title: string; body: string | null; read: boolean; createdAt: string };
export type Prefs = { theme: 'light' | 'system'; locale: string; currency: Currency; notifications: { inApp: boolean; email: boolean } };
export type SessionRow = { id: string; userAgent?: string; ip?: string; createdAt: string; lastUsedAt: string; current: boolean };
export type Summary = {
  currency: Currency; hasData: boolean; balanceMinor: number; income: number; expense: number; net: number; pendingCount: number;
  weeklyIncome: { amountMinor: number; changePct: number | null }; trend: { date: string; balanceMinor: number }[];
};
export type Bucket = { key: string; label: string; incomeMinor: number; expenseMinor: number; netMinor: number; changePct: number | null };
export type Activity = { currency: Currency; period: 'monthly' | 'annual'; hasData: boolean; buckets: Bucket[]; peakIndex: number | null };
type Flow = { incomeMinor: number; expenseMinor: number; netMinor: number };
export type CashFlow = {
  currency: Currency; hasData: boolean; totals: Flow; previous: Flow; change: { incomePct: number | null; expensePct: number | null; netPct: number | null };
  series: ({ month: string } & Flow)[]; breakdown: { income: Cat[]; expense: Cat[] };
  topCounterparties: { contactId: string; name: string; volumeMinor: number; netMinor: number; count: number }[]; statusCounts: Record<string, number>;
};
export type Cat = { category: string; amountMinor: number; count: number; sharePct: number };
export type Compare = { currency: Currency; year: number; hasData: boolean; months: { month: string; thisYear: Flow; lastYear: Flow }[]; totals: { thisYear: Flow; lastYear: Flow; netChangePct: number | null } };
