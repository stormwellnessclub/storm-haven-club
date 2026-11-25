/** Same day next month (clamped to month end), YYYY-MM-DD. */
export function addOneMonth(iso: string): string {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
