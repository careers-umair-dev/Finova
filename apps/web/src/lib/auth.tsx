import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@/api/types';
import { api, ApiError, SIGNED_OUT_EVENT } from './api';

type AuthCtx = {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient(); const navigate = useNavigate();
  const me = useQuery({
    queryKey: ['me'], staleTime: 5 * 60_000, retry: false,
    queryFn: () => api<{ user: User }>('/me').then((d) => d.user).catch((e) => { if (e instanceof ApiError && e.status === 401) return null; throw e; }),
  });
  const enter = useCallback((user: User) => { qc.clear(); qc.setQueryData(['me'], user); }, [qc]);
  const leave = useCallback(() => { qc.clear(); qc.setQueryData(['me'], null); navigate('/login', { replace: true }); }, [qc, navigate]);

  useEffect(() => { // API says the session is gone (revoked elsewhere, or refresh failed)
    window.addEventListener(SIGNED_OUT_EVENT, leave);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, leave);
  }, [leave]);

  const value = useMemo<AuthCtx>(() => ({
    user: me.data ?? null, loading: me.isLoading,
    login: async (email, password) => enter((await api<{ user: User }>('/auth/login', { json: { email, password } })).user),
    register: async (name, email, password) => enter((await api<{ user: User }>('/auth/register', { json: { name, email, password } })).user),
    logout: async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { leave(); } },
  }), [me.data, me.isLoading, enter, leave]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center text-mu" role="status">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
}
