/** Empty in dev and same-site deploys (requests go to /api via the dev proxy or a host rewrite). Set VITE_API_BASE_URL only for a cross-site API. */
export const API_ORIGIN: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const apiUrl = (path: string) => `${API_ORIGIN}/api/v1${path}`;
const BASE = `${API_ORIGIN}/api/v1`;
const HEADERS = { 'X-Requested-With': 'finova' }; // required by the API's CSRF guard on every non-GET
export const SIGNED_OUT_EVENT = 'finova:signed-out';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

/** One refresh at a time: concurrent 401s share a single /auth/refresh call (the API revokes a session if an old refresh token is replayed). */
let refreshing: Promise<boolean> | null = null;
const refresh = () =>
  (refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: HEADERS })
    .then((r) => r.ok, () => false)
    .finally(() => { refreshing = null; }));

export const qs = (q?: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q ?? {})) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

type Opts = { method?: string; json?: unknown; body?: BodyInit; query?: Record<string, unknown>; headers?: Record<string, string> };

export async function api<T = unknown>(path: string, o: Opts = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { ...HEADERS, ...o.headers };
  let body = o.body;
  if (o.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
  const res = await fetch(`${BASE}${path}${qs(o.query)}`, { method: o.method ?? (body !== undefined ? 'POST' : 'GET'), credentials: 'include', headers, body });
  const text = await res.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (res.ok) return payload?.data as T;

  const err = payload?.error;
  const isAuthCall = path.startsWith('/auth/');
  if (res.status === 401 && !isAuthCall) {
    if (err?.code === 'TOKEN_EXPIRED' && !retried && (await refresh())) return api<T>(path, o, true);
    if (path !== '/me') window.dispatchEvent(new Event(SIGNED_OUT_EVENT)); // revoked or unrecoverable session
  }
  throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? res.statusText, err?.details);
}
