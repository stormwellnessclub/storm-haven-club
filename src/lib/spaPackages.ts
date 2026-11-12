// Spa treatment packages (single treatment + series). Prices live in the database
// (spa_treatment_packages) and are edited by managers; nothing here holds a price.

export interface SpaTreatmentPackage {
  id: string;
  service_key: string;
  name: string;
  session_count: number;
  price_cents: number;
  member_price_cents: number | null;
  is_recommended: boolean;
  /** DEPRECATED: replaced by expires_after_months. */
  expires_after_days?: number | null;
  /** Calendar months a purchase stays usable; null = no expiration. */
  expires_after_months: number | null;
  payment_plan_available: boolean;
  is_active: boolean;
  display_order: number;
}

export const formatDollars = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Price per treatment, rounded to the cent. */
export const perTreatmentCents = (p: Pick<SpaTreatmentPackage, "price_cents" | "session_count">) =>
  Math.round(p.price_cents / Math.max(1, p.session_count));

/** "Single 90-Minute Treatment" stays as named; series read "6-Treatment Aella Series". */
export const packageLabel = (p: Pick<SpaTreatmentPackage, "name" | "session_count">) =>
  p.session_count === 1 ? p.name : `${p.session_count}-Treatment ${p.name}`;

/** Active packages for a service, in display order, split into the single visit and the series. */
export function splitPackages(all: SpaTreatmentPackage[], serviceKey: string) {
  const list = all
    .filter((p) => p.service_key === serviceKey && p.is_active)
    .sort((a, b) => a.display_order - b.display_order || a.session_count - b.session_count);
  return { single: list.find((p) => p.session_count === 1) ?? null, series: list.filter((p) => p.session_count > 1) };
}

/** "Use within 8 months" wording for a package's expiration. */
export const expiryLabel = (p: Pick<SpaTreatmentPackage, "expires_after_months">) =>
  p.expires_after_months == null ? null : `Use within ${p.expires_after_months} month${p.expires_after_months === 1 ? "" : "s"}`;
