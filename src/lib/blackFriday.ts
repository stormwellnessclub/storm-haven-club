/** Black Friday 2026 sale settings shared by the sale page. */
export const BLACK_FRIDAY_PROMO = "black_friday_2026";

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function saleHasEnded(endsAt: string | null, now = new Date()): boolean {
  return !!endsAt && new Date(endsAt) < now;
}

export function saleEndLabel(endsAt: string | null): string {
  if (!endsAt) return "";
  const d = new Date(endsAt);
  const day = d.toLocaleDateString("en-US", { timeZone: "America/Detroit", weekday: "long", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });
  return `Ends ${day} at ${time}`;
}
