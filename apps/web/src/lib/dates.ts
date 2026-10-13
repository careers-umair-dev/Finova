export const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const dm = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
export const fmtRange = (from: Date, to: Date | null) => { const end = to ?? new Date(); return `${dm(from)}, ${from.getFullYear()} – ${dm(end)}, ${end.getFullYear()}`; };

/** `to === null` means "now": it is omitted from requests so the server resolves it per request. A frozen `to` would hide anything added after the page loaded. */
export type Range = { from: Date; to: Date | null; key: string };
const DAY = 864e5;
const minute = () => new Date(Math.floor(Date.now() / 60000) * 60000); // stable within a minute so query keys don't churn
export const PRESETS = [
  { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' }, { key: '60d', label: 'Last 60 days' },
  { key: '90d', label: 'Last 90 days' }, { key: 'ytd', label: 'Year to date' },
] as const;
export function presetRange(key: string): Range {
  const now = minute();
  if (key === 'ytd') return { key, from: new Date(now.getFullYear(), 0, 1), to: null };
  const days = Number.parseInt(key, 10) || 60;
  return { key, from: new Date(now.getTime() - days * DAY), to: null };
}
/** From two <input type="date"> values (local dates). `to` is the end of that day; today or later means "now". Null if invalid or > 366 days. */
export function customRange(fromStr: string, toStr: string): Range | null {
  if (!fromStr || !toStr) return null;
  const from = new Date(`${fromStr}T00:00:00`); const end = new Date(`${toStr}T23:59:59.999`);
  const now = new Date(); const to = end >= now ? null : end;
  if (Number.isNaN(+from) || Number.isNaN(+end) || from >= (to ?? now) || +(to ?? now) - +from > 366 * DAY) return null;
  return { key: 'custom', from, to };
}
export const dayStart = (s: string) => (s ? new Date(`${s}T00:00:00`).toISOString() : undefined);
export const dayEnd = (s: string) => (s ? new Date(`${s}T23:59:59.999`).toISOString() : undefined);
