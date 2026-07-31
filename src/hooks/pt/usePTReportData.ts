import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PTReportFilters {
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
  trainerId: string; // "all" | uuid
  clientId: string;  // "all" | uuid
  locationId: string; // "all" | uuid
  sessionTypeId: string; // "all" | uuid
}

export interface PTReportData {
  appointments: any[];
  passes: any[];
  adjustments: any[];
  usage: any[];
  programs: any[];
  performanceTests: any[];
  notes: any[];
}

/** Pulls every record the PT reports need for the selected window. All values are real rows. */
export function usePTReportData(filters: PTReportFilters) {
  const fromIso = new Date(`${filters.from}T00:00:00`).toISOString();
  const toIso = new Date(`${filters.to}T23:59:59`).toISOString();

  return useQuery({
    queryKey: ["pt-report-data", filters],
    queryFn: async (): Promise<PTReportData> => {
      let apptQ = (supabase as any)
        .from("pt_appointments")
        .select("id, user_id, instructor_id, pass_id, location_id, session_type_id, format, starts_at, duration_minutes, status, payment_status, amount_due_cents, completed_at, package_deducted")
        .gte("starts_at", fromIso)
        .lte("starts_at", toIso)
        .limit(5000);
      if (filters.trainerId !== "all") apptQ = apptQ.eq("instructor_id", filters.trainerId);
      if (filters.clientId !== "all") apptQ = apptQ.eq("user_id", filters.clientId);
      if (filters.locationId !== "all") apptQ = apptQ.eq("location_id", filters.locationId);
      if (filters.sessionTypeId !== "all") apptQ = apptQ.eq("session_type_id", filters.sessionTypeId);

      let passQ = (supabase as any)
        .from("pt_passes")
        .select("id, user_id, pack_id, pack_name, format, sessions_total, sessions_remaining, price_cents_charged, activated_at, expires_at, status, purchased_at")
        .limit(3000);
      if (filters.clientId !== "all") passQ = passQ.eq("user_id", filters.clientId);

      const [appts, passes, adjustments, usage, programs, tests, notes] = await Promise.all([
        apptQ,
        passQ,
        (supabase as any)
          .from("pt_pass_adjustments")
          .select("id, pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason, created_by, created_at")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(2000),
        (supabase as any)
          .from("pt_session_usage")
          .select("id, pass_id, used_at")
          .gte("used_at", fromIso)
          .lte("used_at", toIso)
          .limit(3000),
        (supabase as any)
          .from("pt_programs")
          .select("id, user_id, instructor_id, name, status, start_date, end_date, is_template, next_reassessment")
          .limit(2000),
        (supabase as any)
          .from("pt_performance_tests")
          .select("id, user_id, test_name, tested_on, is_reassessment")
          .gte("tested_on", filters.from)
          .lte("tested_on", filters.to)
          .limit(2000),
        (supabase as any)
          .from("pt_session_notes")
          .select("id, appointment_id, user_id, instructor_id, created_at, is_draft")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(3000),
      ]);

      // A failed read must not silently render as "zero sessions" in a report.
      const failed = [appts, passes, adjustments, usage, programs, tests, notes].find((r: any) => r?.error);
      if (failed) throw (failed as any).error;

      return {
        appointments: appts.data ?? [],
        passes: passes.data ?? [],
        adjustments: adjustments.data ?? [],
        usage: usage.data ?? [],
        programs: programs.data ?? [],
        performanceTests: tests.data ?? [],
        notes: notes.data ?? [],
      };
    },
  });
}

export function usePTReportLookups() {
  return useQuery({
    queryKey: ["pt-report-lookups"],
    staleTime: 300_000,
    queryFn: async () => {
      const [trainers, locations, sessionTypes] = await Promise.all([
        (supabase as any).from("instructors").select("id, first_name, last_name, is_active").order("first_name"),
        (supabase as any).from("pt_locations").select("id, name, is_active").order("display_order"),
        (supabase as any).from("pt_session_types").select("id, name, is_active").order("display_order"),
      ]);
      return {
        trainers: (trainers.data ?? []).map((t: any) => ({ id: t.id, name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() })),
        locations: locations.data ?? [],
        sessionTypes: sessionTypes.data ?? [],
      };
    },
  });
}
