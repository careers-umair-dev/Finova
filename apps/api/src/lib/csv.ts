const NUMERIC = /^-?\d+(\.\d+)?$/;
/** Quotes as needed and neutralises spreadsheet formula injection (=, +, -, @) in text cells. */
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (!NUMERIC.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
/** 123450 -> "1234.50" using integer math only. */
export const minorToDecimal = (m: number) => {
  const a = Math.abs(m);
  return `${m < 0 ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
};
