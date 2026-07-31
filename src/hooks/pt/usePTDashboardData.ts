import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, endOfWeek, format as fmtDate, startOfWeek, subDays } from "date-fns";

export interface PTDashboardData {
  todaySessions: any[];
  weekSessions: any[];
  activeClientIds: string[];
  newLeads: any[];
  passes: any[];
  expiringPasses: any[];
  reassessments: any[];
  cancellationsThisWeek: number;
  noShowsThisWeek: number;
  packageUsagePct: number;
  sessionsBanked: number;
}

const isoStart = (d: Date) => new Date(`${fmtDate(d, "yyyy-MM-dd")}T00:00:00`).toISOString();
const isoEnd = (d: Date) => new Date(`${fmtDate(d, "yyyy-MM-dd")}T23:59:59`).toISOString();

export function usePTDashboard() {
  return useQuery({
    queryKey: ["pt-dashboard", fmtDate(new Date(), "yyyy-MM-dd")],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<PTDashboardData> => {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const [weekRes, passesRes, leadsRes, programsRes] = await Promise.all([
        (supabase as any)
          .from("pt_appointments")
          .select("*")
          .gte("starts_at", isoStart(weekStart))
          .lte("starts_at", isoEnd(weekEnd))
          .order("starts_at", { ascending: true }),
        (supabase as any)
          .from("pt_passes")
          .select("id, user_id, pack_name, sessions_total, sessions_remaining, status, expires_at")
          .eq("status", "active"),
        (supabase as any)
          .from("pt_client_profiles")
          .select("user_id, full_name, email, status, created_at")
          .in("status", ["prospect", "lead"])
          .gte("created_at", subDays(today, 30).toISOString())
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("pt_programs")
          .select("id, user_id, name, reassessment_date, status")
          .not("reassessment_date", "is", null)
          .lte("reassessment_date", fmtDate(addDays(today, 14), "yyyy-MM-dd"))
          .order("reassessment_date", { ascending: true }),
      ]);

      // Surface read failures instead of rendering an empty dashboard.
      const failure = [weekRes, passesRes, leadsRes, programsRes].find((r: any) => r?.error);
      if (failure) throw failure.error;

      const week = weekRes.data;
      const passes = passesRes.data;
      const leads = leadsRes.data;
      const programs = programsRes.data;

      const weekSessions = week ?? [];
      const todayKey = fmtDate(today, "yyyy-MM-dd");
      const todaySessions = weekSessions.filter((a: any) => a.starts_at.slice(0, 10) === todayKey);

      const activePasses = passes ?? [];
      const activeClientIds = Array.from(
        new Set(activePasses.filter((p: any) => p.sessions_remaining > 0).map((p: any) => p.user_id)),
      ) as string[];

      const totalSessions = activePasses.reduce((s: number, p: any) => s + (p.sessions_total || 0), 0);
      const remaining = activePasses.reduce((s: number, p: any) => s + (p.sessions_remaining || 0), 0);
      const used = totalSessions - remaining;

      const in30 = fmtDate(addDays(today, 30), "yyyy-MM-dd");
      const expiringPasses = activePasses
        .filter((p: any) => p.expires_at && p.expires_at <= in30 && p.sessions_remaining > 0)
        .sort((a: any, b: any) => a.expires_at.localeCompare(b.expires_at));

      return {
        todaySessions,
        weekSessions,
        activeClientIds,
        newLeads: leads ?? [],
        passes: activePasses,
        expiringPasses,
        reassessments: (programs ?? []).filter((p: any) => p.status !== "archived"),
        cancellationsThisWeek: weekSessions.filter((a: any) => a.status === "cancelled" || a.status === "late_cancel").length,
        noShowsThisWeek: weekSessions.filter((a: any) => a.status === "no_show").length,
        packageUsagePct: totalSessions > 0 ? Math.round((used / totalSessions) * 100) : 0,
        sessionsBanked: remaining,
      };
    },
  });
}
