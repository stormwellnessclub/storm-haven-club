import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTDirectoryRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  initials: string;
  isMember: boolean;
  membershipStatus: string;
  memberSince: string | null;
  primaryTrainerId: string | null;
  clientStatus: string;
  tags: string[];
  activePackName: string | null;
  packageFormat: string | null;
  sessionsRemaining: number;
  packageExpiresAt: string | null;
  lastVisit: string | null;
  nextAppointment: string | null;
  attendanceRate: number | null;
  attendanceCounted: number;
  noShows: number;
  openAlerts: number;
  highAlerts: number;
  reassessmentDue: string | null;
  owedCents: number;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Everything the client CRM needs, assembled in one pass. */
export function usePTClientDirectory() {
  return useQuery({
    queryKey: ["pt-client-directory"],
    staleTime: 30_000,
    queryFn: async (): Promise<PTDirectoryRow[]> => {
      const [
        { data: profiles }, { data: passes }, { data: appts },
        { data: alerts }, { data: programs },
      ] = await Promise.all([
        (supabase as any).from("pt_client_profiles").select("*"),
        (supabase as any).from("pt_passes")
          .select("user_id, pack_name, format, sessions_total, sessions_remaining, status, expires_at"),
        (supabase as any).from("pt_appointments")
          .select("user_id, starts_at, status, payment_status, amount_due_cents, checked_in_at"),
        (supabase as any).from("pt_alerts").select("client_user_id, severity, is_resolved").eq("is_resolved", false),
        (supabase as any).from("pt_programs").select("user_id, next_reassessment, status").not("next_reassessment", "is", null),
      ]);

      const ids = Array.from(new Set([
        ...(profiles ?? []).map((p: any) => p.user_id),
        ...(passes ?? []).map((p: any) => p.user_id),
        ...(appts ?? []).map((a: any) => a.user_id),
      ].filter(Boolean))) as string[];

      const chunk = <T,>(arr: T[], n: number) =>
        Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

      const members: any[] = [];
      const nonMembers: any[] = [];
      const authProfiles: any[] = [];
      for (const part of chunk(ids, 300)) {
        const [{ data: m }, { data: n }, { data: pr }] = await Promise.all([
          supabase.from("members")
            .select("user_id, email, first_name, last_name, phone, photo_url, status, subscription_status, created_at")
            .in("user_id", part),
          supabase.from("non_member_profiles").select("user_id, email, first_name, last_name, phone, created_at").in("user_id", part),
          supabase.from("profiles").select("user_id, email, first_name, last_name, phone, created_at").in("user_id", part),
        ]);
        members.push(...(m ?? [])); nonMembers.push(...(n ?? [])); authProfiles.push(...(pr ?? []));
      }

      const byId = <T extends { user_id: string }>(list: T[]) => {
        const map: Record<string, T> = {};
        list.forEach((x) => { map[x.user_id] = x; });
        return map;
      };
      const memberMap = byId(members);
      const nonMemberMap = byId(nonMembers);
      const authMap = byId(authProfiles);
      const profileMap = byId((profiles ?? []) as any[]);

      const nowIso = new Date().toISOString();

      return ids.map((id) => {
        const m = memberMap[id];
        const nm = nonMemberMap[id];
        const ap = authMap[id];
        const prof: any = profileMap[id] ?? {};

        const name =
          (m ? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() : "") ||
          (nm ? `${nm.first_name ?? ""} ${nm.last_name ?? ""}`.trim() : "") ||
          [prof.first_name, prof.last_name].filter(Boolean).join(" ") || ap?.full_name || m?.email || nm?.email || ap?.email || "Client";
        const email = m?.email ?? nm?.email ?? prof.email ?? ap?.email ?? "";
        const phone = m?.phone ?? nm?.phone ?? prof.phone ?? ap?.phone ?? null;

        const myPasses = (passes ?? []).filter((p: any) => p.user_id === id);
        const active = myPasses
          .filter((p: any) => p.status === "active" && p.sessions_remaining > 0)
          .sort((a: any, b: any) => String(a.expires_at).localeCompare(String(b.expires_at)));
        const sessionsRemaining = active.reduce((s: number, p: any) => s + (p.sessions_remaining || 0), 0);

        const myAppts = (appts ?? []).filter((a: any) => a.user_id === id);
        const completed = myAppts.filter((a: any) => a.status === "completed");
        const noShows = myAppts.filter((a: any) => a.status === "no_show").length;
        const counted = myAppts.filter((a: any) => ["completed", "no_show", "late_cancel"].includes(a.status));
        const attendanceRate = counted.length ? Math.round((completed.length / counted.length) * 100) : null;
        const lastVisit = completed
          .map((a: any) => a.starts_at).sort().slice(-1)[0] ?? null;
        const nextAppointment = myAppts
          .filter((a: any) => a.starts_at >= nowIso && !["cancelled", "late_cancel", "no_show"].includes(a.status))
          .map((a: any) => a.starts_at).sort()[0] ?? null;
        const owedCents = myAppts
          .filter((a: any) => a.payment_status === "unpaid")
          .reduce((s: number, a: any) => s + (a.amount_due_cents || 0), 0);

        const myAlerts = (alerts ?? []).filter((al: any) => al.client_user_id === id);
        const reassessment = (programs ?? [])
          .filter((p: any) => p.user_id === id && p.status !== "archived")
          .map((p: any) => p.next_reassessment).sort()[0] ?? null;

        return {
          userId: id,
          name,
          email,
          phone,
          photoUrl: m?.photo_url ?? null,
          initials: initialsOf(name),
          isMember: !!m,
          membershipStatus: m ? (m.status ?? "unknown") : nm ? "non-member" : "guest",
          memberSince: m?.created_at ?? nm?.created_at ?? ap?.created_at ?? null,
          primaryTrainerId: prof.primary_trainer_id ?? null,
          clientStatus: prof.status ?? (sessionsRemaining > 0 ? "active" : "inactive"),
          tags: (prof.tags ?? []) as string[],
          activePackName: active[0]?.pack_name ?? null,
          packageFormat: active[0]?.format ?? null,
          sessionsRemaining,
          packageExpiresAt: active[0]?.expires_at ?? null,
          lastVisit,
          nextAppointment,
          attendanceRate,
          attendanceCounted: counted.length,
          noShows,
          openAlerts: myAlerts.length,
          highAlerts: myAlerts.filter((al: any) => al.severity === "high" || al.severity === "urgent").length,
          reassessmentDue: reassessment,
          owedCents,
        };
      });
    },
  });
}

/* --------------------------------------------------------------- filters */

export interface PTClientFilters {
  search: string;
  trainer: string;          // "all" | instructor id | "unassigned"
  activity: string;         // all | active | inactive
  packageType: string;      // all | pack name
  packageExpiry: string;    // all | expiring30 | expired | none
  attendance: string;       // all | concern (<70%)
  reassessment: string;     // all | due (<=14d)
  noShow: string;           // all | any | repeat (2+)
  tag: string;              // all | tag
}

export const PT_DEFAULT_FILTERS: PTClientFilters = {
  search: "", trainer: "all", activity: "all", packageType: "all",
  packageExpiry: "all", attendance: "all", reassessment: "all", noShow: "all", tag: "all",
};

export function applyPTClientFilters(rows: PTDirectoryRow[], f: PTClientFilters) {
  const today = new Date();
  const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const q = f.search.trim().toLowerCase();

  return rows.filter((r) => {
    if (q && !`${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.trainer === "unassigned" && r.primaryTrainerId) return false;
    if (f.trainer !== "all" && f.trainer !== "unassigned" && r.primaryTrainerId !== f.trainer) return false;
    if (f.activity === "active" && r.sessionsRemaining <= 0) return false;
    if (f.activity === "inactive" && r.sessionsRemaining > 0) return false;
    if (f.packageType !== "all" && r.activePackName !== f.packageType) return false;
    if (f.packageExpiry === "expiring30" && !(r.packageExpiresAt && r.packageExpiresAt >= todayStr && r.packageExpiresAt <= in30)) return false;
    if (f.packageExpiry === "expired" && !(r.packageExpiresAt && r.packageExpiresAt < todayStr)) return false;
    if (f.packageExpiry === "none" && r.packageExpiresAt) return false;
    if (f.attendance === "concern" && !(r.attendanceRate !== null && r.attendanceRate < 70)) return false;
    if (f.reassessment === "due" && !(r.reassessmentDue && r.reassessmentDue <= in14)) return false;
    if (f.noShow === "any" && r.noShows < 1) return false;
    if (f.noShow === "repeat" && r.noShows < 2) return false;
    if (f.tag !== "all" && !r.tags.includes(f.tag)) return false;
    return true;
  });
}

/* ----------------------------------------------------------- saved views */

export interface PTSavedView {
  id: string;
  name: string;
  filters: PTClientFilters;
  is_shared: boolean;
  owner_id: string;
}

export function usePTSavedViews(scope = "clients") {
  return useQuery({
    queryKey: ["pt-saved-views", scope],
    queryFn: async (): Promise<PTSavedView[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_saved_views")
        .select("id, name, filters, is_shared, owner_id")
        .eq("scope", scope)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTSavedViewMutations(scope = "clients") {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pt-saved-views", scope] });

  const save = useMutation({
    mutationFn: async (input: { name: string; filters: PTClientFilters; isShared: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Sign in required");
      const { error } = await (supabase as any).from("pt_saved_views").insert({
        owner_id: auth.user.id,
        scope,
        name: input.name,
        filters: input.filters,
        is_shared: input.isShared,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("View saved"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save view"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pt_saved_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("View removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove view"),
  });

  return { save, remove };
}

/** Distinct package names and tags present in the directory, for filter dropdowns. */
export function usePTDirectoryFacets(rows: PTDirectoryRow[]) {
  return useMemo(() => {
    const packs = Array.from(new Set(rows.map((r) => r.activePackName).filter(Boolean))) as string[];
    const tags = Array.from(new Set(rows.flatMap((r) => r.tags))).sort();
    return { packs: packs.sort(), tags };
  }, [rows]);
}
