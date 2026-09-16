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
  /** When the person applied / joined, if they did. */
  resolvedAt: string | null;
  attemptCount: number;
  attemptDates: string[];
}

export interface AbandonedApplicationsResult {
  /** Genuinely unfinished — the only people who may be emailed a reminder. */
  cardSaved: AbandonedAttempt[];
  noCard: AbandonedAttempt[];
  /** Started, then submitted an application (never mixed into the lead list). */
  appliedLater: AbandonedAttempt[];
  /** Started, then became a member. */
  memberLater: AbandonedAttempt[];
  /** Test / internal records. */
  testRows: AbandonedAttempt[];
  incomplete: AbandonedAttempt[];
  totals: {
    rows: number;
    people: number;
    mergedAttempts: number;
    alreadyApplied: number;
    alreadyMember: number;
    testRows: number;
    lastAttemptAt: string | null;
    /** Raw attempt rows in the window. */
    last7: number;
    last30: number;
    /** Distinct people in the window. */
    people7: number;
    people30: number;
    /** Of the people in the window, how many are still unfinished. */
    unfinished7: number;
    unfinished30: number;
    /** Card saves/updates by existing members — excluded from the lead list. */
    memberCardUpdates: number;
  };
}

export const ABANDONED_APPLICATIONS_QUERY_KEY = ["abandoned-applications"] as const;

const TEST_EMAIL_PATTERN = /(test@|@example\.com|@test\.com)/i;

const normalizeName = (v?: string | null) => (v || "").toLowerCase().replace(/[^a-z]/g, "");

/** An attempt is only "resolved" when the matching record was created at/after the attempt. */
const RESOLVED_GRACE_MS = 60 * 60 * 1000; // 1h grace for records written just before the attempt row

function resolvedAfter(recordAt: string | null | undefined, attemptAt: string) {
  if (!recordAt) return false;
  return new Date(recordAt).getTime() >= new Date(attemptAt).getTime() - RESOLVED_GRACE_MS;
}

async function fetchAbandonedApplications(): Promise<AbandonedApplicationsResult> {
  // Only attempts that came from the public application form can be leads.
  // Anything tied to a member record, or made in the member/admin portal, is
  // card maintenance for an existing member and never belongs in this list.
  const [{ data, error }, memberUpdatesRes] = await Promise.all([
    supabase
      .from("card_setup_attempts")
      .select(
        "id, member_id, stripe_customer_id, status, source, created_at, reminder_sent_at, reminder_count, card_brand, card_last4, metadata",
      )
      .is("application_id", null)
      .is("member_id", null)
      .eq("source", "self_service")
      .in("status", ["initiated", "abandoned", "failed", "succeeded"])
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("card_setup_attempts")
      .select("id", { count: "exact", head: true })
      .is("application_id", null)
      .not("member_id", "is", null),
  ]);

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
        resolvedAt: null,
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
    supabase.from("membership_applications").select("email, full_name, created_at"),
    supabase.from("members").select("email, first_name, last_name, created_at"),
  ]);

  // email -> newest record timestamp
  const appEmails = new Map<string, string>();
  const memberEmails = new Map<string, string>();
  const knownNames = new Map<string, string>();
  const keepNewest = (map: Map<string, string>, key: string, at: string) => {
    const prev = map.get(key);
    if (!prev || new Date(at).getTime() > new Date(prev).getTime()) map.set(key, at);
  };
  for (const row of (appsRes.data || []) as any[]) {
    if (row.email) keepNewest(appEmails, String(row.email).toLowerCase().trim(), row.created_at);
    const n = normalizeName(row.full_name);
    if (n) knownNames.set(n, row.email || row.full_name);
  }
  for (const row of (membersRes.data || []) as any[]) {
    if (row.email)
      keepNewest(memberEmails, String(row.email).toLowerCase().trim(), row.created_at);
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
    let resolvedAt: string | null = null;
    if (TEST_EMAIL_PATTERN.test(email)) {
      filterReason = "test_email";
    } else if (memberEmails.has(email)) {
      // Anyone with a member record is never a lead, whenever they joined.
      filterReason = "already_member";
      resolvedAt = memberEmails.get(email) ?? null;
    } else if (appEmails.has(email)) {
      // An application on file means they finished the form — not a lead.
      filterReason = "already_applied";
      resolvedAt = appEmails.get(email) ?? null;
    }

    const nameKey = normalizeName(meta?.applicant_name);
    all.push({
      ...newest,
      metadata: meta,
      reminder_count: newest.reminder_count ?? 0,
      filterReason,
      resolvedAt,
      attemptCount: list.length,
      attemptDates: list.map((a: any) => a.created_at),
      possibleDuplicateOf:
        filterReason === "none" && nameKey ? knownNames.get(nameKey) ?? null : null,
    });
  }

  const visible = all.filter((a) => a.filterReason === "none");

  const now = Date.now();
  const withinDays = (iso: string, days: number) =>
    now - new Date(iso).getTime() <= days * 86400000;
  const attemptsSince = (days: number) =>
    rows.filter((r) => withinDays(r.created_at, days)).length;
  // A person counts in the window if any of their attempts happened in it.
  // Only identifiable people (grouped by email) are counted here, because those are
  // the only ones that appear in the lists below. Records with no email captured are
  // counted separately as incompleteIn(), so the headline never promises names the
  // staff cannot find on screen.
  const inWindow = (p: AbandonedAttempt, days: number) =>
    p.attemptDates.some((d) => withinDays(d, days));
  const peopleIn = (days: number) => all.filter((p) => inWindow(p, days));
  const incompleteIn = (days: number) => incomplete.filter((p) => inWindow(p, days));

  return {
    cardSaved: visible.filter((a) => a.status === "succeeded"),
    noCard: visible.filter((a) => a.status !== "succeeded"),
    appliedLater: all.filter((a) => a.filterReason === "already_applied"),
    memberLater: all.filter((a) => a.filterReason === "already_member"),
    testRows: all.filter((a) => a.filterReason === "test_email"),
    incomplete,
    totals: {
      rows: rows.length,
      people: all.length + incomplete.length,
      mergedAttempts,
      alreadyApplied: all.filter((a) => a.filterReason === "already_applied").length,
      alreadyMember: all.filter((a) => a.filterReason === "already_member").length,
      testRows: all.filter((a) => a.filterReason === "test_email").length,
      lastAttemptAt: rows[0]?.created_at ?? null,
      last7: attemptsSince(7),
      last30: attemptsSince(30),
      people7: peopleIn(7).length,
      people30: peopleIn(30).length,
      unfinished7: peopleIn(7).filter((p) => p.filterReason === "none").length,
      unfinished30: peopleIn(30).filter((p) => p.filterReason === "none").length,
      incomplete7: incompleteIn(7).length,
      incomplete30: incompleteIn(30).length,
      memberCardUpdates: memberUpdatesRes.count ?? 0,
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
