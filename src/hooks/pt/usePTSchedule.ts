import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PtFormat, cancelOutcomeMessage } from "@/lib/ptFormat";

/* --------------------------------------------------------------- reference */

export interface PTLocation {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  is_active: boolean;
}

export function usePTLocations() {
  return useQuery({
    queryKey: ["pt-locations"],
    staleTime: 300_000,
    queryFn: async (): Promise<PTLocation[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_locations")
        .select("id, name, code, color, is_active")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PTSessionType {
  id: string;
  name: string;
  code: string | null;
  format: PtFormat | null;
  duration_minutes: number;
  capacity: number;
  requires_package: boolean;
  color: string | null;
}

export function usePTSessionTypes() {
  return useQuery({
    queryKey: ["pt-session-types"],
    staleTime: 300_000,
    queryFn: async (): Promise<PTSessionType[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_session_types")
        .select("id, name, code, format, duration_minutes, capacity, requires_package, color")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTLookupMaps() {
  const { data: locations = [] } = usePTLocations();
  const { data: sessionTypes = [] } = usePTSessionTypes();
  return useMemo(() => {
    const loc: Record<string, PTLocation> = {};
    locations.forEach((l) => { loc[l.id] = l; });
    const st: Record<string, PTSessionType> = {};
    sessionTypes.forEach((s) => { st[s.id] = s; });
    return { locations, sessionTypes, locationMap: loc, sessionTypeMap: st };
  }, [locations, sessionTypes]);
}

/* ------------------------------------------------------------ appointments */

export interface PTScheduleAppointment {
  id: string;
  user_id: string;
  instructor_id: string | null;
  location_id: string | null;
  session_type_id: string | null;
  format: PtFormat;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  confirmation_status: string | null;
  confirmed_at: string | null;
  checked_in_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  is_waitlist: boolean | null;
  waitlist_position: number | null;
  notes: string | null;
  internal_notes: string | null;
  package_deducted: boolean | null;
  pass_id: string | null;
  payment_status: string | null;
  amount_due_cents: number | null;
  confirmation_email_sent_at: string | null;
}

/** Derived lifecycle state used for status styling across the portal. */
export type PTLifecycle =
  | "waitlisted" | "tentative" | "confirmed" | "scheduled"
  | "in_progress" | "completed" | "cancelled" | "no_show";

export function ptLifecycle(a: Pick<PTScheduleAppointment,
  "status" | "confirmation_status" | "started_at" | "completed_at" | "is_waitlist">): PTLifecycle {
  if (a.is_waitlist) return "waitlisted";
  if (a.status === "no_show") return "no_show";
  if (a.status === "cancelled" || a.status === "late_cancel") return "cancelled";
  if (a.status === "completed") return "completed";
  if (a.started_at && !a.completed_at) return "in_progress";
  if (a.confirmation_status === "tentative") return "tentative";
  if (a.confirmation_status === "confirmed") return "confirmed";
  return "scheduled";
}

export const PT_LIFECYCLE_LABEL: Record<PTLifecycle, string> = {
  waitlisted: "Waitlisted",
  tentative: "Tentative",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

/** Card styling per lifecycle state — border, surface and accent bar. */
export const PT_LIFECYCLE_STYLE: Record<PTLifecycle, { card: string; bar: string; badge: "neutral" | "gold" | "green" | "amber" | "red" | "noir" }> = {
  waitlisted: { card: "bg-pt-beige/60 border-pt-line border-dashed", bar: "bg-pt-muted", badge: "neutral" },
  tentative: { card: "bg-white border-pt-amber/50 border-dashed", bar: "bg-pt-amber", badge: "amber" },
  confirmed: { card: "bg-white border-pt-green/45", bar: "bg-pt-green", badge: "green" },
  scheduled: { card: "bg-white border-pt-gold/50", bar: "bg-pt-gold", badge: "gold" },
  in_progress: { card: "bg-pt-gold/10 border-pt-gold ring-1 ring-pt-gold/40", bar: "bg-pt-gold", badge: "gold" },
  completed: { card: "bg-pt-green/5 border-pt-green/30", bar: "bg-pt-green", badge: "green" },
  cancelled: { card: "bg-pt-line/20 border-pt-line text-pt-muted line-through", bar: "bg-pt-line", badge: "neutral" },
  no_show: { card: "bg-pt-red/5 border-pt-red/40", bar: "bg-pt-red", badge: "red" },
};

export function usePTScheduleAppointments(opts: {
  fromIso: string;
  toIso: string;
  trainerId?: string;
  locationId?: string;
  sessionTypeId?: string;
  status?: string;
}) {
  const { fromIso, toIso, trainerId, locationId, sessionTypeId, status } = opts;
  return useQuery({
    queryKey: ["pt-appointments", "schedule", fromIso, toIso, trainerId, locationId, sessionTypeId, status],
    queryFn: async (): Promise<PTScheduleAppointment[]> => {
      let q = (supabase as any)
        .from("pt_appointments")
        .select("*")
        .gte("starts_at", fromIso)
        .lte("starts_at", toIso)
        .order("starts_at", { ascending: true });
      if (trainerId && trainerId !== "all") q = q.eq("instructor_id", trainerId);
      if (locationId && locationId !== "all") q = q.eq("location_id", locationId);
      if (sessionTypeId && sessionTypeId !== "all") q = q.eq("session_type_id", sessionTypeId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as PTScheduleAppointment[];
      if (status && status !== "all") rows = rows.filter((r) => ptLifecycle(r) === status);
      return rows;
    },
  });
}

/* ------------------------------------------------------------ appt actions */

export function usePTAppointmentActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
    qc.invalidateQueries({ queryKey: ["pt-passes"] });
    qc.invalidateQueries({ queryKey: ["pt-dashboard"] });
  };

  async function patch(id: string, values: Record<string, any>, message?: string) {
    const { error } = await (supabase as any).from("pt_appointments").update(values).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    if (message) toast.success(message);
    invalidate();
    return true;
  }

  const checkIn = (id: string) =>
    patch(id, { checked_in_at: new Date().toISOString(), confirmation_status: "confirmed" }, "Client checked in");

  const startSession = (id: string) =>
    patch(id, { started_at: new Date().toISOString(), checked_in_at: new Date().toISOString() }, "Session started");

  /**
   * Completing goes through the atomic RPC so package deduction, session notes
   * and the appointment status all move together (and never double-deduct).
   */
  const completeSession = async (id: string, deduct = false) => {
    const { error } = await (supabase as any).rpc("pt_complete_session", {
      p_appointment_id: id,
      p_note: {},
      p_deduct: deduct,
    });
    if (error) { toast.error(error.message); return false; }
    toast.success("Session completed");
    invalidate();
    return true;
  };

  const markNoShow = (id: string) =>
    patch(id, { status: "no_show", no_show_at: new Date().toISOString() }, "Marked as no-show");

  const confirm = (id: string) =>
    patch(id, { confirmation_status: "confirmed", confirmed_at: new Date().toISOString() }, "Marked confirmed");

  const setTentative = (id: string) => patch(id, { confirmation_status: "tentative" }, "Marked tentative");

  const changeTrainer = (id: string, instructorId: string | null) =>
    patch(id, { instructor_id: instructorId }, "Trainer updated");

  const addNote = (id: string, notes: string, internal: boolean) =>
    patch(id, internal ? { internal_notes: notes } : { notes }, "Note saved");

  /** Moves the real package balance, not just the flag on the appointment. */
  const setPackageDeducted = async (id: string, deducted: boolean) => {
    const { data, error } = await (supabase as any).rpc("pt_set_package_deduction", {
      p_appointment_id: id,
      p_deduct: deducted,
    });
    if (error) {
      toast.error(
        error.message?.includes("NO_SESSIONS")
          ? "This client has no package session available to deduct."
          : error.message ?? "Could not update the package credit",
      );
      return false;
    }
    const remaining = (data as any)?.sessions_remaining;
    toast.success(
      `${deducted ? "Package credit deducted" : "Package credit restored"}${
        typeof remaining === "number" ? ` · ${remaining} left` : ""
      }`,
    );
    invalidate();
    return true;
  };

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) => {
      const { data, error } = await (supabase as any).rpc("cancel_pt_appointment", {
        p_appointment_id: id, p_reason: reason,
      });
      if (error) throw error;
      supabase.functions
        .invoke("send-pt-booking-email", { body: { appointment_id: id, type: "cancellation" } })
        .catch(() => {});
      const row = Array.isArray(data) ? data[0] : data;
      return row?.cancel_credit_outcome as string | undefined;
    },
    onSuccess: (outcome) => { toast.success(cancelOutcomeMessage(outcome)); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel"),
  });


  const sendConfirmation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("send-pt-booking-email", {
        body: { appointment_id: id, type: "confirmation" },
      });
      if (error) throw error;
      await (supabase as any)
        .from("pt_appointments")
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => { toast.success("Confirmation sent"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not send confirmation"),
  });

  /** Reschedule / reassign with server-side conflict validation. */
  const reschedule = useMutation({
    mutationFn: async (input: {
      id: string;
      startsAt?: string;
      durationMinutes?: number;
      instructorId?: string | null;
      locationId?: string | null;
      force?: boolean;
    }) => {
      const { data, error } = await (supabase as any).rpc("pt_reschedule_appointment", {
        p_appointment_id: input.id,
        p_starts_at: input.startsAt ?? null,
        p_duration_minutes: input.durationMinutes ?? null,
        p_instructor_id: input.instructorId ?? null,
        p_location_id: input.locationId ?? null,
        p_force: input.force ?? false,
      });
      if (error) throw error;
      return data as { success: boolean; conflict: any };
    },
    onSuccess: (res) => {
      if (res?.success) { toast.success("Session moved"); invalidate(); }
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not move session"),
  });

  return {
    checkIn, startSession, completeSession, markNoShow, confirm, setTentative,
    changeTrainer, addNote, setPackageDeducted, cancel, sendConfirmation, reschedule,
  };
}

/** Active package balance for a client. */
export function usePTClientPasses(userId?: string) {
  return useQuery({
    queryKey: ["pt-passes", "client", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select("id, pack_name, format, sessions_total, sessions_remaining, status, expires_at")
        .eq("user_id", userId)
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------ alerts panel */

export function usePTAlerts(includeResolved = false) {
  return useQuery({
    queryKey: ["pt-alerts", includeResolved],
    queryFn: async () => {
      let q = (supabase as any)
        .from("pt_alerts")
        .select("id, client_user_id, alert_type, severity, message, due_date, is_resolved, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!includeResolved) q = q.eq("is_resolved", false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useResolvePTAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("pt_alerts")
        .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: auth?.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alert resolved"); qc.invalidateQueries({ queryKey: ["pt-alerts"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not resolve alert"),
  });
}
