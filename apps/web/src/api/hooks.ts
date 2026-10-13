import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { browserTz } from '@/lib/dates';
import { formatMinor } from '@/lib/money';
import type * as T from './types';

type Q = Record<string, unknown>;
const keep = { placeholderData: keepPreviousData };

/* ---- reads ---- */
export const useWallets = (includeArchived = false) =>
  useQuery({ queryKey: ['wallets', includeArchived], queryFn: () => api<{ wallets: T.Wallet[]; totals: Record<string, number> }>('/wallets', { query: { includeArchived } }) });
export const useSummary = (p: Q, enabled = true) =>
  useQuery({ queryKey: ['summary', p], enabled, queryFn: () => api<T.Summary>('/dashboard/summary', { query: { ...p, tz: browserTz } }), ...keep });
export const useActivity = (p: Q, enabled = true) =>
  useQuery({ queryKey: ['activity', p], enabled, queryFn: () => api<T.Activity>('/dashboard/activity', { query: { ...p, tz: browserTz } }), ...keep });
export const useTransactions = (p: Q, enabled = true) =>
  useQuery({ queryKey: ['transactions', p], enabled, queryFn: () => api<T.Page<T.Tx>>('/transactions', { query: p }), ...keep });
export const useCashFlow = (p: Q, enabled = true) =>
  useQuery({ queryKey: ['reports', 'cash-flow', p], enabled, queryFn: () => api<T.CashFlow>('/reports/cash-flow', { query: { ...p, tz: browserTz } }), ...keep });
export const useCompare = (p: Q, enabled = true) =>
  useQuery({ queryKey: ['reports', 'compare', p], enabled, queryFn: () => api<T.Compare>('/reports/compare', { query: { ...p, tz: browserTz } }), ...keep });
export const useContacts = (p: Q) => useQuery({ queryKey: ['contacts', p], queryFn: () => api<T.Page<T.Contact>>('/contacts', { query: p }), ...keep });
export const useContactDetail = (id: string | null) =>
  useQuery({ queryKey: ['contacts', 'detail', id], enabled: !!id, queryFn: () => api<T.ContactDetail>(`/contacts/${id}`) });
export const useDocuments = (p: Q) => useQuery({ queryKey: ['documents', p], queryFn: () => api<T.Page<T.Doc>>('/documents', { query: p }), ...keep });
export const useNotifications = (p: Q = {}) =>
  useQuery({ queryKey: ['notifications', p], queryFn: () => api<T.Page<T.Notice> & { unreadCount: number }>('/notifications', { query: p }), refetchInterval: 60_000 });
export const usePrefs = () => useQuery({ queryKey: ['prefs'], queryFn: () => api<{ preferences: T.Prefs }>('/me/preferences').then((d) => d.preferences), staleTime: 5 * 60_000 });
export const useSessions = () => useQuery({ queryKey: ['sessions'], queryFn: () => api<{ sessions: T.SessionRow[] }>('/me/sessions').then((d) => d.sessions) });

/** Money formatter that honours the user's locale preference. */
export function useMoney() {
  const locale = usePrefs().data?.locale ?? 'en-US';
  return (minor: number, currency: string) => formatMinor(minor, currency, locale);
}

/* ---- writes: anything touching the ledger refreshes every derived view ---- */
const LEDGER_KEYS = ['wallets', 'summary', 'activity', 'transactions', 'reports', 'notifications', 'contacts'];
export const refreshLedger = (qc: QueryClient) => Promise.all(LEDGER_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));

export function useCreateWallet() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: { name: string; currency: string; openingBalance?: string }) => api<{ wallet: T.Wallet }>('/wallets', { json: b }), onSuccess: () => refreshLedger(qc) });
}
export function useUpdateWallet() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...b }: { id: string; name?: string; archived?: boolean; currency?: string; openingBalance?: string }) => api<{ wallet: T.Wallet }>(`/wallets/${id}`, { method: 'PATCH', json: b }), onSuccess: () => refreshLedger(qc) });
}
/** `key` is generated once per dialog open, so a double-click or network retry can never post the entry twice. */
export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...b }: { key: string; walletId: string; type: 'income' | 'expense'; amount: string; status: 'completed' | 'pending'; description?: string; contactId?: string }) =>
      api<{ transaction: T.Tx; replayed: boolean }>('/transactions', { json: b, headers: { 'Idempotency-Key': key } }),
    onSuccess: () => refreshLedger(qc),
  });
}
export function usePatchTransaction() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...b }: { id: string; status?: 'completed' | 'failed'; description?: string }) => api<{ transaction: T.Tx }>(`/transactions/${id}`, { method: 'PATCH', json: b }), onSuccess: () => refreshLedger(qc) });
}
export function useSaveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: { id?: string; name?: string; email?: string | null; phone?: string | null; notes?: string | null; archived?: boolean }) =>
      id ? api<{ contact: T.Contact }>(`/contacts/${id}`, { method: 'PATCH', json: b }) : api<{ contact: T.Contact }>('/contacts', { json: b }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name, category }: { file: File; name: string; category: string }) =>
      api<{ document: T.Doc }>('/documents', { body: file, query: { name, category }, headers: { 'Content-Type': file.type } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }) });
}
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => (id ? api(`/notifications/${id}/read`, { method: 'PATCH' }) : api('/notifications/read-all', { method: 'POST' })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
export function useSavePrefs() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: Partial<T.Prefs>) => api<{ preferences: T.Prefs }>('/me/preferences', { method: 'PATCH', json: b }), onSuccess: (d) => qc.setQueryData(['prefs'], d.preferences) });
}
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/me/sessions/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) });
}

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
