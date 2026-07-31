import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PTShellCounts {
  openTasks: number;
  overdueTasks: number;
  unresolvedAlerts: number;
  openMessages: number;
}

/** Badge counts for the PT portal shell (tasks, alerts, messages). */
export function usePTShellCounts() {
  return useQuery({
    queryKey: ["pt-shell-counts"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<PTShellCounts> => {
      const nowIso = new Date().toISOString();
      const [tasks, overdue, alerts, messages] = await Promise.all([
        (supabase as any).from("pt_tasks").select("id", { count: "exact", head: true }).is("completed_at", null),
        (supabase as any).from("pt_tasks").select("id", { count: "exact", head: true }).is("completed_at", null).lt("due_at", nowIso),
        (supabase as any).from("pt_alerts").select("id", { count: "exact", head: true }).eq("is_resolved", false),
        (supabase as any).from("email_conversations").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
      ]);
      return {
        openTasks: tasks?.count ?? 0,
        overdueTasks: overdue?.count ?? 0,
        unresolvedAlerts: alerts?.count ?? 0,
        openMessages: messages?.count ?? 0,
      };
    },
  });
}

export interface PTSearchResult {
  id: string;
  group: "Clients" | "Trainers" | "Appointments" | "Programs" | "Packages";
  title: string;
  subtitle?: string;
  to: string;
}

/** Global search across clients, trainers, appointments, programs and packages. */
export function usePTGlobalSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["pt-global-search", q],
    enabled: q.length >= 2,
    staleTime: 15_000,
    queryFn: async (): Promise<PTSearchResult[]> => {
      const like = `%${q}%`;
      const [members, nonMembers, trainers, programs, packs, passes] = await Promise.all([
        supabase.from("members").select("user_id, first_name, last_name, email").or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`
        ).limit(6),
        supabase.from("non_member_profiles").select("user_id, first_name, last_name, email").or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`
        ).limit(6),
        (supabase as any).rpc("get_instructors_with_contact"),
        (supabase as any).from("pt_programs").select("id, name, user_id, goal, status").ilike("name", like).limit(5),
        (supabase as any).from("pt_packs").select("id, name, sessions, format").ilike("name", like).limit(5),
        (supabase as any).from("pt_passes").select("id, user_id, pack_name, sessions_remaining, status").ilike("pack_name", like).limit(5),
      ]);

      const results: PTSearchResult[] = [];

      (members.data ?? []).forEach((m: any) => {
        if (!m.user_id) return;
        results.push({
          id: `member-${m.user_id}`,
          group: "Clients",
          title: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
          subtitle: `Member · ${m.email}`,
          to: `/admin/pt/clients/${m.user_id}`,
        });
      });
      (nonMembers.data ?? []).forEach((m: any) => {
        if (!m.user_id) return;
        results.push({
          id: `nonmember-${m.user_id}`,
          group: "Clients",
          title: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
          subtitle: `Non-member · ${m.email}`,
          to: `/admin/pt/clients/${m.user_id}`,
        });
      });
      const needle = q.toLowerCase();
      ((trainers.data ?? []) as any[])
        .filter((t: any) =>
          [t.first_name, t.last_name, t.email]
            .filter(Boolean)
            .some((v: string) => String(v).toLowerCase().includes(needle)),
        )
        .slice(0, 5)
        .forEach((t: any) => {
        results.push({
          id: `trainer-${t.id}`,
          group: "Trainers",
          title: `${t.first_name} ${t.last_name}`,
          subtitle: t.is_active ? t.email : `Inactive · ${t.email}`,
          to: `/admin/pt/trainers`,
        });
      });
      (programs.data ?? []).forEach((p: any) => {
        results.push({
          id: `program-${p.id}`,
          group: "Programs",
          title: p.name,
          subtitle: [p.goal, p.status].filter(Boolean).join(" · "),
          to: `/admin/pt/programs`,
        });
      });
      (packs.data ?? []).forEach((p: any) => {
        results.push({
          id: `pack-${p.id}`,
          group: "Packages",
          title: p.name,
          subtitle: `${p.sessions} sessions`,
          to: `/admin/pt/packages`,
        });
      });
      (passes.data ?? []).forEach((p: any) => {
        results.push({
          id: `pass-${p.id}`,
          group: "Packages",
          title: p.pack_name,
          subtitle: `${p.sessions_remaining} remaining · ${p.status}`,
          to: `/admin/pt/clients/${p.user_id}`,
        });
      });

      // Appointments — match on client name resolved from the above people search
      const peopleIds = [
        ...(members.data ?? []).map((m: any) => m.user_id),
        ...(nonMembers.data ?? []).map((m: any) => m.user_id),
      ].filter(Boolean);
      if (peopleIds.length) {
        const { data: appts } = await (supabase as any)
          .from("pt_appointments")
          .select("id, user_id, starts_at, status, format")
          .in("user_id", peopleIds)
          .order("starts_at", { ascending: false })
          .limit(5);
        const nameById = new Map<string, string>();
        results.filter((r) => r.group === "Clients").forEach((r) => {
          nameById.set(r.to.split("/").pop() as string, r.title);
        });
        (appts ?? []).forEach((a: any) => {
          results.push({
            id: `appt-${a.id}`,
            group: "Appointments",
            title: `${nameById.get(a.user_id) ?? "Session"} — ${new Date(a.starts_at).toLocaleString("en-US", {
              timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            })}`,
            subtitle: a.status,
            to: `/admin/pt/schedule`,
          });
        });
      }

      return results;
    },
  });
}
