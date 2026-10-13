export interface PersonActivity {
  person_key: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  sms_opt_in: boolean;
  audience: "member" | "non_member" | "contact";
  member_id: string | null;
  membership_type: string | null;
  member_status: string | null;
  class_count: number;
  class_90d: number;
  last_class_date: string | null;
  class_type_ids: string[];
  spa_count: number;
  massage_count: number;
  last_spa_date: string | null;
  recovery_count: number;
  last_recovery_at: string | null;
  cafe_count: number;
  cafe_spend: number;
  last_cafe_at: string | null;
  pt_count: number;
  last_pt_at: string | null;
  body_roller_sessions: number;
  last_checkin_at: string | null;
}

export type Activity = "any" | "classes" | "massage" | "spa" | "recovery" | "cafe" | "pt" | "body_roller";

export interface AudienceFilters {
  who: "all" | "member" | "non_member";
  tier: string; // "all" or substring
  activity: Activity;
  classTypeId: string; // "all" or id
  /** "ever" | "within" (last N days) | "not_within" (did it before, but not in last N days) | "never" */
  timing: "ever" | "within" | "not_within" | "never";
  days: number;
  minCount: number;
  minCafeSpend: number;
}

export const DEFAULT_FILTERS: AudienceFilters = {
  who: "all", tier: "all", activity: "any", classTypeId: "all",
  timing: "ever", days: 30, minCount: 1, minCafeSpend: 0,
};

function lastAt(p: PersonActivity, a: Activity): string | null {
  switch (a) {
    case "classes": return p.last_class_date;
    case "massage": case "spa": return p.last_spa_date;
    case "recovery": return p.last_recovery_at;
    case "cafe": return p.last_cafe_at;
    case "pt": return p.last_pt_at;
    default: return null;
  }
}
function countOf(p: PersonActivity, a: Activity): number {
  switch (a) {
    case "classes": return p.class_count;
    case "massage": return p.massage_count;
    case "spa": return p.spa_count;
    case "recovery": return p.recovery_count;
    case "cafe": return p.cafe_count;
    case "pt": return p.pt_count;
    case "body_roller": return p.body_roller_sessions;
    default: return 0;
  }
}

/** Pure filter used by the audience builder. `now` is injectable for tests. */
export function matchesFilters(p: PersonActivity, f: AudienceFilters, now = new Date()): boolean {
  if (f.who !== "all" && p.audience !== f.who && !(f.who === "non_member" && p.audience === "contact")) return false;
  if (f.tier !== "all" && !(p.membership_type ?? "").toLowerCase().includes(f.tier.toLowerCase())) return false;
  if (f.minCafeSpend > 0 && Number(p.cafe_spend) < f.minCafeSpend) return false;
  if (f.activity === "any") return true;
  if (f.activity === "classes" && f.classTypeId !== "all" && f.timing !== "never" && !p.class_type_ids.includes(f.classTypeId)) return false;
  const n = countOf(p, f.activity);
  if (f.timing === "never") return n === 0;
  if (n < Math.max(1, f.minCount)) return false;
  if (f.timing === "ever" || f.activity === "body_roller") return true;
  const last = lastAt(p, f.activity);
  const cutoff = now.getTime() - f.days * 86400000;
  const recent = !!last && new Date(last).getTime() >= cutoff;
  return f.timing === "within" ? recent : !recent;
}

export function isReachable(p: PersonActivity) {
  return p.sms_opt_in && !!p.user_id && (p.phone ?? "").replace(/\D/g, "").length >= 10;
}
