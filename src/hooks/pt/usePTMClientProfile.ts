import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ptmToast } from "@/components/admin/pt/mobile/ptmToast";
import { clubMonthStartDateStr } from "@/lib/clubTime";

/**
 * Mobile client profile data layer.
 *
 * The summary query is intentionally small so the screen paints fast; every
 * deeper history section is lazy and only fetched once its accordion opens.
 */

export interface PTMClientSummary {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  isMember: boolean;
  status: string;              // active | prospect | paused | inactive | archived
  membershipStatus: string;
  memberSince: string | null;
  primaryTrainerId: string | null;
  primaryTrainerName: string | null;
  sessionsCompleted: number;
  sessionsThisMonth: number;
  attendanceRate: number | null;
  attendanceCounted: number;
  noShows: number;
  nextAppointment: {
    id: string;
    startsAt: string;
    format: string | null;
    status: string;
    trainerName: string | null;
  } | null;
  primaryGoal: string | null;
  goals: string[];
  activePackage: {
    id: string;
    name: string;
    remaining: number;
    total: number;
    expiresAt: string | null;
  } | null;
  restrictions: string[];
  injuries: string[];
  medicalClearanceRequired: boolean;
  topAlert: { id: string; message: string; severity: string } | null;
  openAlerts: number;
  lastSessionFocus: { date: string; focus: string | null; homework: string | null } | null;
  reassessment: { dueOn: string; programName: string | null } | null;
  emergency: { name: string | null; phone: string | null; relationship: string | null };
  communicationPrefs: Record<string, boolean>;
  internalNotes: string | null;
  medicalNotes: string | null;
  parqStatus: string;
  dateOfBirth: string | null;
}

const nameFromParts = (first?: string | null, last?: string | null) =>
  `${first ?? ""} ${last ?? ""}`.trim();

const asStrings = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((v) => (typeof v === "string" ? v : v?.label ?? v?.name ?? v?.text ?? v?.description ?? ""))
      .filter(Boolean);
  }
  if (typeof val === "string") return [val];
  return [];
};

export function usePTMClientSummary(userId?: string) {
  return useQuery({
    queryKey: ["ptm-client-summary", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<PTMClientSummary> => {
      const monthStart = clubMonthStartDateStr();
      const nowIso = new Date().toISOString();

      const [
        { data: profile },
        { data: member },
        { data: nonMember },
        { data: authProfile },
        { data: appts },
        { data: passes },
        { data: alerts },
        { data: programs },
        { data: notes },
      ] = await Promise.all([
        (supabase as any).from("pt_client_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("members")
          .select("user_id, email, first_name, last_name, phone, photo_url, status, subscription_status, created_at")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("non_member_profiles")
          .select("user_id, email, first_name, last_name, phone, created_at")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, created_at")
          .eq("user_id", userId!)
          .maybeSingle(),
        (supabase as any)
          .from("pt_appointments")
          .select("id, starts_at, status, format, instructor_id")
          .eq("user_id", userId)
          .order("starts_at", { ascending: true }),
        (supabase as any)
          .from("pt_passes")
          .select("id, pack_name, sessions_total, sessions_remaining, status, expires_at")
          .eq("user_id", userId),
        (supabase as any)
          .from("pt_alerts")
          .select("id, message, severity, alert_type")
          .eq("client_user_id", userId)
          .eq("is_resolved", false),
        (supabase as any)
          .from("pt_programs")
          .select("id, name, goal, next_reassessment, status, focus_today")
          .eq("user_id", userId)
          .neq("status", "archived"),
        (supabase as any)
          .from("pt_session_notes")
          .select("session_date, next_focus, homework, observations")
          .eq("user_id", userId)
          .eq("is_draft", false)
          .order("session_date", { ascending: false })
          .limit(1),
      ]);

      const prof: any = profile ?? {};
      const m: any = member ?? null;
      const nm: any = nonMember ?? null;
      const ap: any = authProfile ?? null;

      const name =
        nameFromParts(m?.first_name, m?.last_name) ||
        nameFromParts(nm?.first_name, nm?.last_name) ||
        prof.full_name ||
        ap?.full_name ||
        m?.email ||
        nm?.email ||
        ap?.email ||
        "Client";

      const all = (appts ?? []) as any[];
      const completed = all.filter((a) => a.status === "completed");
      const counted = all.filter((a) => ["completed", "no_show", "late_cancel"].includes(a.status));
      const noShows = all.filter((a) => a.status === "no_show").length;
      const sessionsThisMonth = completed.filter((a) => String(a.starts_at).slice(0, 10) >= monthStart).length;
      const next =
        all.find(
          (a) => a.starts_at >= nowIso && !["cancelled", "late_cancel", "no_show", "completed"].includes(a.status),
        ) ?? null;

      // Trainer names (primary + next appointment) in a single lookup.
      const instructorIds = Array.from(
        new Set([prof.primary_trainer_id, next?.instructor_id].filter(Boolean)),
      ) as string[];
      let trainerNames: Record<string, string> = {};
      if (instructorIds.length) {
        const { data: instructors } = await (supabase as any)
          .from("instructors")
          .select("id, first_name, last_name")
          .in("id", instructorIds);
        (instructors ?? []).forEach((i: any) => {
          trainerNames[i.id] = nameFromParts(i.first_name, i.last_name) || "Trainer";
        });
      }

      const activePasses = ((passes ?? []) as any[])
        .filter((p) => p.status === "active" && (p.sessions_remaining ?? 0) > 0)
        .sort((a, b) => String(a.expires_at ?? "9999").localeCompare(String(b.expires_at ?? "9999")));
      const activePass = activePasses[0] ?? null;
      const remainingTotal = activePasses.reduce((s, p) => s + (p.sessions_remaining || 0), 0);

      const alertRows = (alerts ?? []) as any[];
      const rank: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
      const topAlert =
        alertRows.slice().sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0))[0] ?? null;

      const activeProgram = ((programs ?? []) as any[])
        .filter((p) => p.next_reassessment)
        .sort((a, b) => String(a.next_reassessment).localeCompare(String(b.next_reassessment)))[0] ?? null;

      const goals = asStrings(prof.goals);
      const lastNote = ((notes ?? []) as any[])[0] ?? null;

      return {
        userId: userId!,
        name,
        email: m?.email ?? nm?.email ?? prof.email ?? ap?.email ?? null,
        phone: m?.phone ?? nm?.phone ?? prof.phone ?? ap?.phone ?? null,
        photoUrl: m?.photo_url ?? null,
        isMember: !!m,
        status: prof.status ?? (remainingTotal > 0 ? "active" : "inactive"),
        membershipStatus: m ? m.status ?? "unknown" : nm ? "non-member" : "guest",
        memberSince: m?.created_at ?? nm?.created_at ?? ap?.created_at ?? null,
        primaryTrainerId: prof.primary_trainer_id ?? null,
        primaryTrainerName: prof.primary_trainer_id ? trainerNames[prof.primary_trainer_id] ?? null : null,
        sessionsCompleted: completed.length,
        sessionsThisMonth,
        attendanceRate: counted.length ? Math.round((completed.length / counted.length) * 100) : null,
        attendanceCounted: counted.length,
        noShows,
        nextAppointment: next
          ? {
              id: next.id,
              startsAt: next.starts_at,
              format: next.format ?? null,
              status: next.status,
              trainerName: next.instructor_id ? trainerNames[next.instructor_id] ?? null : null,
            }
          : null,
        primaryGoal: goals[0] ?? activeProgram?.goal ?? null,
        goals,
        activePackage: activePass
          ? {
              id: activePass.id,
              name: activePass.pack_name ?? "Package",
              remaining: remainingTotal,
              total: activePass.sessions_total ?? remainingTotal,
              expiresAt: activePass.expires_at ?? null,
            }
          : null,
        restrictions: asStrings(prof.restrictions),
        injuries: asStrings(prof.injuries),
        medicalClearanceRequired: !!prof.medical_clearance_required,
        topAlert: topAlert ? { id: topAlert.id, message: topAlert.message, severity: topAlert.severity } : null,
        openAlerts: alertRows.length,
        lastSessionFocus: lastNote
          ? {
              date: lastNote.session_date,
              focus: lastNote.next_focus ?? lastNote.observations ?? null,
              homework: lastNote.homework ?? null,
            }
          : null,
        reassessment: activeProgram
          ? { dueOn: activeProgram.next_reassessment, programName: activeProgram.name ?? null }
          : null,
        emergency: {
          name: prof.emergency_contact_name ?? null,
          phone: prof.emergency_contact_phone ?? null,
          relationship: prof.emergency_contact_relationship ?? null,
        },
        communicationPrefs: (prof.communication_prefs ?? {}) as Record<string, boolean>,
        internalNotes: prof.internal_notes ?? null,
        medicalNotes: prof.medical_notes ?? null,
        parqStatus: prof.parq_status ?? "not_started",
        dateOfBirth: prof.date_of_birth ?? null,
      };
    },
  });
}

/* ------------------------------------------------------------ lazy sections */

type LazyOpts = {
  column?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  select?: string;
};

/** Reads a per-client table only once its section has been opened. */
export function usePTMLazySection<T = any>(
  table: string,
  userId: string | undefined,
  enabled: boolean,
  opts: LazyOpts = {},
) {
  const { column = "user_id", orderBy = "created_at", ascending = false, limit = 25, select = "*" } = opts;
  return useQuery({
    queryKey: ["ptm-client-section", table, userId, orderBy, limit],
    enabled: !!userId && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select(select)
        .eq(column, userId)
        .order(orderBy, { ascending })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

/* ------------------------------------------------------------------ actions */

export function usePTMClientActions(userId?: string) {
  const qc = useQueryClient();

  const invalidate = (tables: string[] = []) => {
    qc.invalidateQueries({ queryKey: ["ptm-client-summary", userId] });
    tables.forEach((t) =>
      qc.invalidateQueries({ queryKey: ["ptm-client-section", t, userId], exact: false }),
    );
  };

  const actorId = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const addSessionNote = useMutation({
    mutationFn: async (input: { observations: string; next_focus?: string; homework?: string }) => {
      const { error } = await (supabase as any).from("pt_session_notes").insert({
        user_id: userId,
        created_by: await actorId(),
        is_draft: false,
        observations: input.observations,
        next_focus: input.next_focus || null,
        homework: input.homework || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ptmToast.success("Note saved");
      invalidate(["pt_session_notes"]);
    },
    onError: (e: any) => ptmToast.error("Could not save note", e?.message),
  });

  const savePrivateNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await (supabase as any)
        .from("pt_client_profiles")
        .upsert({ user_id: userId, internal_notes: text, updated_by: await actorId() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      ptmToast.success("Private note saved");
      invalidate();
    },
    onError: (e: any) => ptmToast.error("Could not save note", e?.message),
  });

  const recordProgress = useMutation({
    mutationFn: async (input: { weight_lbs?: number | null; body_fat_pct?: number | null; notes?: string | null }) => {
      const { error } = await (supabase as any).from("pt_body_metrics").insert({
        user_id: userId,
        created_by: await actorId(),
        measured_on: new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" }),
        weight_lbs: input.weight_lbs ?? null,
        body_fat_pct: input.body_fat_pct ?? null,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ptmToast.success("Progress recorded");
      invalidate(["pt_body_metrics"]);
    },
    onError: (e: any) => ptmToast.error("Could not record progress", e?.message),
  });

  const logCommunication = useMutation({
    mutationFn: async (input: { channel: string; body: string; subject?: string | null }) => {
      const { error } = await (supabase as any).from("pt_communications").insert({
        client_user_id: userId,
        created_by: await actorId(),
        direction: "outbound",
        delivery_status: "logged",
        sent_at: new Date().toISOString(),
        channel: input.channel,
        subject: input.subject ?? null,
        body: input.body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ptmToast.success("Message logged");
      invalidate(["pt_communications"]);
    },
    onError: (e: any) => ptmToast.error("Could not log message", e?.message),
  });

  const createTask = useMutation({
    mutationFn: async (input: { title: string; detail?: string; due_at?: string | null; priority?: string }) => {
      const actor = await actorId();
      const { error } = await (supabase as any).from("pt_tasks").insert({
        title: input.title,
        detail: input.detail || null,
        client_user_id: userId,
        due_at: input.due_at || null,
        priority: input.priority ?? "medium",
        status: "todo",
        created_by: actor,
        assigned_to: actor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ptmToast.success("Task created");
      invalidate(["pt_tasks"]);
    },
    onError: (e: any) => ptmToast.error("Could not create task", e?.message),
  });

  const assignProgram = useMutation({
    mutationFn: async (input: { programId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("pt_programs")
        .update({ status: input.status })
        .eq("id", input.programId);
      if (error) throw error;
    },
    onSuccess: () => {
      ptmToast.success("Program updated");
      invalidate(["pt_programs"]);
    },
    onError: (e: any) => ptmToast.error("Could not update program", e?.message),
  });

  return { addSessionNote, savePrivateNote, recordProgress, logCommunication, createTask, assignProgram };
}

/* -------------------------------------------------------------- formatting */

export function ptmFormatDate(value?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const iso = value.length <= 10 ? `${value}T12:00:00` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Detroit",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function ptmFormatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Detroit",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ptmDaysUntil(value?: string | null): number | null {
  if (!value) return null;
  const iso = value.length <= 10 ? `${value}T12:00:00` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function usePTMClientTitle(summary?: PTMClientSummary) {
  return useMemo(() => summary?.name ?? "Client", [summary?.name]);
}
