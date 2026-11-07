// Pure retention logic for the admin Retention portal. Visits are one row per
// member per Detroit day per activity kind (from admin_retention_visits).

export type VisitKind = "checkin" | "class" | "pt" | "spa" | "recovery";
export interface Visit { member_id: string; visit_day: string; kind: VisitKind | string }
export interface RetentionMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  membership_type: string | null;
  status: string | null;
  membership_start_date: string | null;
  activated_at: string | null;
}

export type Segment =
  | "thriving" | "steady" | "slipping" | "at_risk"
  | "never_started" | "gone_quiet" | "new" | "frozen";

export const SEGMENT_LABEL: Record<Segment, string> = {
  thriving: "Thriving", steady: "Steady", slipping: "Slipping", at_risk: "At Risk",
  never_started: "Never Started", gone_quiet: "Gone Quiet", new: "New (under 14 days)", frozen: "Frozen",
};

export const KIND_LABEL: Record<string, string> = {
  checkin: "club visit", class: "classes", pt: "personal training", spa: "spa", recovery: "recovery",
};

export interface MemberRetention {
  member: RetentionMember;
  segment: Segment;
  risk: number;
  lastVisit: string | null;
  daysSinceLast: number | null;
  tenureDays: number;
  visits7: number;
  visits14: number;
  visits30: number;
  baselinePerWeek: number;
  recentPerWeek: number;
  favoriteKind: string | null;
  usualWeekday: string | null;
  reason: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY = 86400000;
const toMs = (d: string) => Date.parse(d.slice(0, 10) + "T00:00:00Z");
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

/** Statuses that are never part of retention scoring. */
export function isExcludedStatus(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  return s === "cancelled" || s === "canceled" || s === "expired" || s.startsWith("pending");
}

export function computeMember(m: RetentionMember, visits: Visit[], today: string): MemberRetention {
  const start = (m.activated_at ?? m.membership_start_date ?? today).slice(0, 10);
  const tenureDays = Math.max(0, daysBetween(start, today));
  const mine = visits.filter((v) => v.visit_day >= start);
  const days = Array.from(new Set(mine.map((v) => v.visit_day))).sort();
  const count = (from: number, to: number) =>
    days.filter((d) => { const ago = daysBetween(d, today); return ago >= from && ago < to; }).length;
  const visits7 = count(0, 7), visits14 = count(0, 14), visits30 = count(0, 30);
  const baseWindow = Math.min(60, Math.max(0, tenureDays - 14));
  const baselinePerWeek = baseWindow >= 14 ? (count(14, 14 + baseWindow) / baseWindow) * 7 : 0;
  const recentPerWeek = visits14 / 2;
  const lastVisit = days.length ? days[days.length - 1] : null;
  const daysSinceLast = lastVisit ? daysBetween(lastVisit, today) : null;

  const kindCount: Record<string, number> = {};
  mine.forEach((v) => { if (v.kind !== "checkin") kindCount[v.kind] = (kindCount[v.kind] ?? 0) + 1; });
  const favoriteKind = Object.entries(kindCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? (days.length ? "checkin" : null);
  const wd: number[] = Array(7).fill(0);
  days.forEach((d) => wd[new Date(toMs(d)).getUTCDay()]++);
  const topWd = wd.indexOf(Math.max(...wd));
  const usualWeekday = days.length >= 3 ? WEEKDAYS[topWd] : null;

  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  let segment: Segment; let risk: number; let reason: string;
  const status = (m.status ?? "").toLowerCase();
  if (status === "frozen") {
    segment = "frozen"; risk = 0; reason = "Membership is frozen";
  } else if (!lastVisit) {
    if (tenureDays >= 14) { segment = "never_started"; risk = Math.min(100, 70 + Math.floor(tenureDays / 7)); reason = `Joined ${tenureDays} days ago, never visited`; }
    else { segment = "new"; risk = 20; reason = `Joined ${tenureDays} days ago, no visit yet`; }
  } else if (daysSinceLast! >= 30) {
    segment = "gone_quiet"; risk = Math.min(100, 75 + Math.floor((daysSinceLast! - 30) / 7) * 3);
    reason = `No visit in ${daysSinceLast} days`;
  } else if (baselinePerWeek >= 0.5 && (daysSinceLast! >= 14 || recentPerWeek <= baselinePerWeek * 0.25)) {
    segment = "at_risk"; risk = 60 + Math.min(15, daysSinceLast!);
    reason = `Usually ${fmt(baselinePerWeek)}×/week, ${visits14} in the last 14 days`;
  } else if (baselinePerWeek >= 0.5 && recentPerWeek < baselinePerWeek * 0.6) {
    segment = "slipping"; risk = 40 + Math.round((1 - recentPerWeek / baselinePerWeek) * 20);
    reason = `Down from ${fmt(baselinePerWeek)}×/week to ${fmt(recentPerWeek)}×/week`;
  } else if (recentPerWeek >= 2) {
    segment = "thriving"; risk = 5; reason = `${fmt(recentPerWeek)} visits/week lately`;
  } else {
    segment = "steady"; risk = daysSinceLast! >= 14 ? 35 : 15; reason = `Last visit ${daysSinceLast} days ago`;
  }

  return { member: m, segment, risk, lastVisit, daysSinceLast, tenureDays, visits7, visits14, visits30,
    baselinePerWeek, recentPerWeek, favoriteKind, usualWeekday, reason };
}

export function computeAll(members: RetentionMember[], visits: Visit[], today: string): MemberRetention[] {
  const byMember = new Map<string, Visit[]>();
  visits.forEach((v) => { const a = byMember.get(v.member_id) ?? []; a.push(v); byMember.set(v.member_id, a); });
  return members
    .filter((m) => !isExcludedStatus(m.status))
    .map((m) => computeMember(m, byMember.get(m.id) ?? [], today))
    .sort((a, b) => b.risk - a.risk);
}

/** A warm, specific opener built from the member's own habits. */
export function suggestedOpener(r: MemberRetention): string {
  const name = r.member.first_name?.trim() || "there";
  const kind = r.favoriteKind && r.favoriteKind !== "checkin" ? KIND_LABEL[r.favoriteKind] : null;
  if (r.segment === "never_started" || r.segment === "new")
    return `Hi ${name}, it's [your name] from Storm. We haven't gotten to meet you yet and I'd love to show you around myself. Is there a day this week that works?`;
  const habit = kind && r.usualWeekday ? `${kind} on ${r.usualWeekday}s` : kind ? kind : r.usualWeekday ? `seeing you on ${r.usualWeekday}s` : "seeing you around the club";
  return `Hi ${name}, it's [your name] from Storm. We've missed ${habit}. Just checking in. Is everything okay, and is there anything we can do to make it easier to come in?`;
}

export interface CohortRow { month: string; joined: number; d30: number | null; d60: number | null; d90: number | null }

/** Share of members (who reached day N) with any visit in the 30 days before day N. */
export function cohorts(members: RetentionMember[], visits: Visit[], today: string): CohortRow[] {
  const byMember = new Map<string, string[]>();
  visits.forEach((v) => { const a = byMember.get(v.member_id) ?? []; a.push(v.visit_day); byMember.set(v.member_id, a); });
  const groups = new Map<string, RetentionMember[]>();
  members.filter((m) => (m.status ?? "").toLowerCase() !== "pending_activation").forEach((m) => {
    const s = (m.activated_at ?? m.membership_start_date)?.slice(0, 7); if (!s) return;
    const g = groups.get(s) ?? []; g.push(m); groups.set(s, g);
  });
  const pct = (list: RetentionMember[], n: number) => {
    const eligible = list.filter((m) => daysBetween((m.activated_at ?? m.membership_start_date)!.slice(0, 10), today) >= n);
    if (!eligible.length) return null;
    const ok = eligible.filter((m) => {
      const start = (m.activated_at ?? m.membership_start_date)!.slice(0, 10);
      return (byMember.get(m.id) ?? []).some((d) => { const k = daysBetween(start, d); return k > n - 30 && k <= n; });
    }).length;
    return Math.round((ok / eligible.length) * 100);
  };
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, list]) => ({ month, joined: list.length, d30: pct(list, 30), d60: pct(list, 60), d90: pct(list, 90) }));
}

export interface WeekPoint { weekStart: string; visits: number; uniqueMembers: number }
export function weeklyTrend(visits: Visit[], today: string, weeks = 12): WeekPoint[] {
  const out: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const startMs = toMs(today) - (w * 7 + 6) * DAY, endMs = toMs(today) - w * 7 * DAY;
    const inWeek = visits.filter((v) => { const t = toMs(v.visit_day); return t >= startMs && t <= endMs; });
    const memberDays = new Set(inWeek.map((v) => v.member_id + v.visit_day));
    out.push({ weekStart: new Date(startMs).toISOString().slice(5, 10), visits: memberDays.size,
      uniqueMembers: new Set(inWeek.map((v) => v.member_id)).size });
  }
  return out;
}
