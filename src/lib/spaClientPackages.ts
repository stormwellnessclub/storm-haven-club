// A client's purchased single treatments and series (spa_client_packages) and the sessions
// booked from them. Sessions used = booked appointments that weren't cancelled.

export interface SpaClientPackage {
  id: string;
  user_id: string;
  service_key: string;
  package_name: string;
  sessions_total: number;
  price_paid_cents: number;
  purchased_at: string;
  expires_on: string | null;
  status: "active" | "refunded" | "void";
}

export interface SeriesAppointment {
  id: string;
  client_package_id: string | null;
  appointment_date: string; // yyyy-MM-dd
  appointment_time: string;
  status: string;
  treatment_zone_name?: string | null;
}

export interface SeriesSummary {
  pkg: SpaClientPackage;
  used: number;
  remaining: number;
  expired: boolean;
  /** Active, not expired and with a session left. */
  usable: boolean;
  next: SeriesAppointment | null;
  previous: SeriesAppointment[];
}

export function summarizeSeries(pkg: SpaClientPackage, appointments: SeriesAppointment[], today: string): SeriesSummary {
  const mine = appointments.filter((a) => a.client_package_id === pkg.id && a.status !== "cancelled");
  const used = mine.length;
  const remaining = Math.max(0, pkg.sessions_total - used);
  const expired = !!pkg.expires_on && pkg.expires_on < today;
  const byTime = (a: SeriesAppointment, b: SeriesAppointment) =>
    `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`);
  const upcoming = mine.filter((a) => a.status === "confirmed" && a.appointment_date >= today).sort(byTime);
  const previous = mine.filter((a) => !upcoming.includes(a)).sort(byTime).reverse();
  return { pkg, used, remaining, expired, usable: pkg.status === "active" && !expired && remaining > 0, next: upcoming[0] ?? null, previous };
}

/** A series can pay for a date only on or before its expiration. */
export const seriesCoversDate = (pkg: Pick<SpaClientPackage, "expires_on">, date: string) => !pkg.expires_on || date <= pkg.expires_on;

/** Today's date in Michigan (America/Detroit) as yyyy-MM-dd. */
export function detroitToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
