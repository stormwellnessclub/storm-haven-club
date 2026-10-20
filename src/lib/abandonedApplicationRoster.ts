import type { AbandonedAttempt, AbandonedApplicationsResult } from "@/hooks/useAbandonedApplications";

export interface SubmitFailure {
  id: string;
  created_at: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
}

export type RosterFilter = "unfinished" | "week" | "month" | "card" | "no_card" | "failed" | "history";
export interface ApplicationRosterRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  dates: string[];
  stage: string;
  unfinished: boolean;
  attempt?: AbandonedAttempt;
  failure?: SubmitFailure;
}

export function applicationRoster(grouped: AbandonedApplicationsResult | undefined, failures: SubmitFailure[]): ApplicationRosterRow[] {
  const rows: ApplicationRosterRow[] = [];
  const buckets: [AbandonedAttempt[], string, boolean][] = [
    [grouped?.cardSaved ?? [], "Card saved", true],
    [grouped?.noCard ?? [], "No card entered", true],
    [grouped?.appliedLater ?? [], "Already applied", false],
    [grouped?.memberLater ?? [], "Already a member", false],
    [grouped?.testRows ?? [], "Test record", false],
    [grouped?.incomplete ?? [], "Incomplete record", true],
  ];
  for (const [attempts, stage, unfinished] of buckets) {
    for (const a of attempts) {
      const meta = a.metadata as (AbandonedAttempt["metadata"] & { applicant_phone?: string; phone?: string });
      rows.push({ id: a.id, name: meta?.applicant_name || "Unknown", email: meta?.applicant_email || "", phone: meta?.applicant_phone || meta?.phone || "", createdAt: a.created_at, dates: a.attemptDates, stage, unfinished, attempt: a });
    }
  }
  for (const f of failures) {
    const email = f.email?.trim().toLowerCase();
    const existing = email ? rows.find((r) => r.email.trim().toLowerCase() === email) : undefined;
    if (existing) {
      existing.dates = [...new Set([...existing.dates, f.created_at])];
      if (!existing.failure || f.created_at > existing.failure.created_at) existing.failure = f;
      existing.phone ||= f.phone || "";
      if (f.created_at > existing.createdAt) existing.createdAt = f.created_at;
      if (existing.unfinished) existing.stage = "Failed submit";
    } else {
      rows.push({ id: `submit:${f.id}`, name: `${f.first_name || ""} ${f.last_name || ""}`.trim() || "Unknown", email: f.email || "", phone: f.phone || "", createdAt: f.created_at, dates: [f.created_at], stage: "Failed submit", unfinished: true, failure: f });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function detroitDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function filterApplicationRoster(rows: ApplicationRosterRow[], filter: RosterFilter, search = "", now = new Date()): ApplicationRosterRow[] {
  const today = detroitDay(now.toISOString());
  const day = new Date(`${today}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const weekStart = day.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const term = search.trim().toLowerCase();
  return rows.filter((r) => {
    const matchesTime = (start: string) => r.dates.some((d) => detroitDay(d) >= start && detroitDay(d) <= today);
    const matches = filter === "history" ||
      (filter === "unfinished" && r.unfinished) ||
      (filter === "week" && matchesTime(weekStart)) ||
      (filter === "month" && matchesTime(monthStart)) ||
      (filter === "card" && r.unfinished && r.attempt?.status === "succeeded") ||
      (filter === "no_card" && r.unfinished && !!r.attempt && r.attempt.status !== "succeeded" && !!r.email) ||
      (filter === "failed" && r.unfinished && !!r.failure);
    return matches && (!term || `${r.name} ${r.email} ${r.phone} ${r.stage}`.toLowerCase().includes(term));
  });
}