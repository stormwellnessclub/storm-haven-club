/** Neutralise spreadsheet formula injection: prefix cells that start with a formula character. */
export function neutralizeCsvFormula(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+(\.\d+)?$/.test(s)) return `'${s}`;
  return s;
}
