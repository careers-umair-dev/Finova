import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, SIGNED_OUT_EVENT } from './api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends credentials and the CSRF header, and unwraps { data }', async () => {
    const f = vi.fn().mockResolvedValue(json(200, { data: { ok: 1 } })); vi.stubGlobal('fetch', f);
    expect(await api('/wallets', { query: { includeArchived: false, q: '' } })).toEqual({ ok: 1 });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('/api/v1/wallets?includeArchived=false'); // empty values are dropped
    expect(init.credentials).toBe('include'); expect(init.headers['X-Requested-With']).toBe('finova');
  });
  it('shares ONE refresh between concurrent expired requests, then retries them', async () => {
    let refreshes = 0; const seen = new Set<string>();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise((r) => setTimeout(r, 10)); return json(200, { data: { ok: true } }); }
      if (!seen.has(url)) { seen.add(url); return json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }); }
      return json(200, { data: url });
    }));
    const [a, b, c] = await Promise.all([api('/wallets'), api('/me'), api('/contacts')]);
    expect([a, b, c]).toEqual(['/api/v1/wallets', '/api/v1/me', '/api/v1/contacts']);
    expect(refreshes).toBe(1);
  });
  it('signs the user out when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/auth/refresh') ? json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }) : json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } })));
    const out = vi.fn(); window.addEventListener(SIGNED_OUT_EVENT, out);
    await expect(api('/wallets')).rejects.toBeInstanceOf(ApiError);
    expect(out).toHaveBeenCalledTimes(1); window.removeEventListener(SIGNED_OUT_EVENT, out);
  });
  it('does not treat a logged-out /me as a forced sign-out, and surfaces API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })));
    const out = vi.fn(); window.addEventListener(SIGNED_OUT_EVENT, out);
    await expect(api('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(out).not.toHaveBeenCalled(); window.removeEventListener(SIGNED_OUT_EVENT, out);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(422, { error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough' } })));
    await expect(api('/transactions', { json: {} })).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS', message: 'Not enough' });
  });
});
