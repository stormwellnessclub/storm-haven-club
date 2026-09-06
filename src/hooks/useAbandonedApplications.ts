import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FilterReason = "none" | "already_applied" | "already_member" | "test_email";

export interface AbandonedAttempt {
  id: string;
  stripe_customer_id: string;
  status: string;
  source: string;
  created_at: string;
  reminder_sent_at: string | null;
  reminder_count: number | null;
  card_brand?: string | null;
  card_last4?: string | null;
  metadata: {
    applicant_email?: string;
    applicant_name?: string;
  } | null;
  possibleDuplicateOf?: string | null;
  filterReason: FilterReason;
  attemptCount: number;
  attemptDates: string[];
}

export interface AbandonedApplicationsResult {
  cardSaved: AbandonedAttempt[];
  noCard: AbandonedAttempt[];
  filtered: AbandonedAttempt[];
  incomplete: AbandonedAttempt[];
  totals: {
    rows: number;
    people: number;
    mergedAttempts: number;
    alreadyApplied: number;
    alreadyMember: number;
    testRows: number;
  };
}

export const ABANDONED_APPLICATIONS_QUERY_KEY = ["abandoned-applications"] as const;

const TEST_EMAIL_PATTERN = /(test@|@example\.com|@test\.com)/i;

const normalizeName = (v?: string | null) => (v || "").toLowerCase().replace(/[^a-z]/g, "");

async function fetchAbandonedApplications(): Promise<AbandonedApplicationsResult> {
  const { data, error } = await supabase
    .from("card_setup_attempts")
    .select(
      "id, stripe_customer_id, status, source, created_at, reminder_sent_at, reminder_count, card_brand, card_last4, metadata",
    )
    .is("application_id", null)
    .in("status", ["initiated", "abandoned", "failed", "succeeded"])
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const rows = (data || []) as any[];

  // Rows with no identity captured at all — never dropped silently.
  const incomplete: AbandonedAttempt[] = [];
  // Group by email, newest first (query is already ordered desc).
  const byEmail = new Map<string, any[]>();

  for (const attempt of rows) {
    const meta = attempt.metadata as AbandonedAttempt["metadata"];
    const email = meta?.applicant_email?.toLowerCase().trim();
    if (!email) {
      incomplete.push({
        ...attempt,
        metadata: meta,
        reminder_count: attempt.reminder_count ?? 0,
        filterReason: "none",
        attemptCount: 1,
        attemptDates: [attempt.created_at],
      });
      continue;
    }
    const list = byEmail.get(email);
    if (list) list.push(attempt);
    else byEmail.set(email, [attempt]);
  }

  const [appsRes, membersRes] = await Promise.all([
    supabase.from("membership_applications").select("email, full_name"),
    supabase.from("members").select("email, first_name, last_name"),
  ]);

  const appEmails = new Set<string>();
  const memberEmails = new Set<string>();
  const knownNames = new Map<string, string>();
  for (const row of (appsRes.data || []) as any[]) {
    if (row.email) appEmails.add(String(row.email).toLowerCase().trim());
    const n = normalizeName(row.full_name);
    if (n) knownNames.set(n, row.email || row.full_name);
  }
  for (const row of (membersRes.data || []) as any[]) {
    if (row.email) memberEmails.add(String(row.email).toLowerCase().trim());
    const n = normalizeName(`${row.first_name || ""}${row.last_name || ""}`);
    if (n) knownNames.set(n, row.email || `${row.first_name} ${row.last_name}`);
  }

  const all: AbandonedAttempt[] = [];
  let mergedAttempts = 0;

  for (const [email, list] of byEmail) {
    const newest = list[0];
    mergedAttempts += list.length - 1;
    const meta = newest.metadata as AbandonedAttempt["metadata"];

    let filterReason: FilterReason = "none";
    if (TEST_EMAIL_PATTERN.test(email)) filterReason = "test_email";
    else if (memberEmails.has(email)) filterReason = "already_member";
    else if (appEmails.has(email)) filterReason = "already_applied";

    const nameKey = normalizeName(meta?.applicant_name);
    all.push({
      ...newest,
      metadata: meta,
      reminder_count: newest.reminder_count ?? 0,
      filterReason,
      attemptCount: list.length,
      attemptDates: list.map((a: any) => a.created_at),
      possibleDuplicateOf:
        filterReason === "none" && nameKey ? knownNames.get(nameKey) ?? null : null,
    });
  }

  const visible = all.filter((a) => a.filterReason === "none");

  return {
    cardSaved: visible.filter((a) => a.status === "succeeded"),
    noCard: visible.filter((a) => a.status !== "succeeded"),
    filtered: all.filter((a) => a.filterReason !== "none"),
    incomplete,
    totals: {
      rows: rows.length,
      people: all.length + incomplete.length,
      mergedAttempts,
      alreadyApplied: all.filter((a) => a.filterReason === "already_applied").length,
      alreadyMember: all.filter((a) => a.filterReason === "already_member").length,
      testRows: all.filter((a) => a.filterReason === "test_email").length,
    },
  };
}

/** Shared source of truth for the abandoned applications list and its badge count. */
export function useAbandonedApplications(enabled = true) {
  return useQuery({
    queryKey: ABANDONED_APPLICATIONS_QUERY_KEY,
    queryFn: fetchAbandonedApplications,
    enabled,
    staleTime: 60_000,
  });
}

/** Number of real people still waiting in the abandoned list (excludes filtered/incomplete). */
export function useAbandonedApplicationsCount() {
  const { data } = useAbandonedApplications();
  return (data?.cardSaved.length ?? 0) + (data?.noCard.length ?? 0);
}
