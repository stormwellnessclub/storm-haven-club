import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMCard, PTMBadge, PTMEmpty, PTMListSkeleton } from "@/components/admin/pt/mobile/PTMobileUI";
import { usePTMobileAccess } from "@/hooks/pt/usePTMobileAccess";

type ListKey =
  | "notes" | "follow-ups" | "packages-expiring" | "reassessments" | "unconfirmed" | "alerts";

const TITLES: Record<ListKey, string> = {
  notes: "Notes to complete",
  "follow-ups": "Client follow-ups",
  "packages-expiring": "Packages expiring",
  reassessments: "Reassessments due",
  unconfirmed: "Unconfirmed",
  alerts: "Client alerts",
};

interface Row {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: "neutral" | "gold" | "green" | "amber" | "red";
  to?: string;
}

/** Filtered mobile lists opened from the Today action items. */
export default function PTMActionList() {
  const { listKey } = useParams<{ listKey: ListKey }>();
  const key = (listKey ?? "notes") as ListKey;
  const navigate = useNavigate();
  const { isAdmin } = usePTMobileAccess();

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ptm-action-list", key, isAdmin],
    staleTime: 15_000,
    queryFn: async (): Promise<Row[]> => {
      const today = new Date();
      const soon = format(addDays(today, 21), "yyyy-MM-dd");

      const nameMapFor = async (ids: string[]) => {
        const map = new Map<string, string>();
        if (!ids.length) return map;
        const [{ data: profs }, { data: mems }] = await Promise.all([
          (supabase as any).from("pt_client_profiles").select("user_id, full_name, email").in("user_id", ids),
          (supabase as any).from("members").select("user_id, first_name, last_name, email").in("user_id", ids),
        ]);
        (mems ?? []).forEach((m: any) =>
          map.set(m.user_id, [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email));
        (profs ?? []).forEach((p: any) => { if (p.full_name) map.set(p.user_id, p.full_name); });
        return map;
      };

      if (key === "notes") {
        const [{ data: appts }, { data: notes }] = await Promise.all([
          (supabase as any).from("pt_appointments")
            .select("id, user_id, starts_at, completed_at")
            .eq("status", "completed")
            .gte("completed_at", addDays(today, -30).toISOString())
            .order("starts_at", { ascending: false }),
          (supabase as any).from("pt_session_notes").select("appointment_id, is_draft"),
        ]);
        const byAppt = new Map((notes ?? []).map((n: any) => [n.appointment_id, n]));
        const missing = (appts ?? []).filter((a: any) => {
          const n: any = byAppt.get(a.id);
          return !n || n.is_draft;
        });
        const names = await nameMapFor(missing.map((a: any) => a.user_id));
        return missing.map((a: any) => ({
          id: a.id,
          title: names.get(a.user_id) ?? "Client",
          subtitle: format(new Date(a.starts_at), "EEE, MMM d · h:mm a"),
          badge: byAppt.has(a.id) ? "Draft" : "Missing",
          tone: byAppt.has(a.id) ? "amber" : "red",
          to: `/admin/pt/m/session/${a.id}`,
        }));
      }

      if (key === "unconfirmed") {
        const { data } = await (supabase as any).from("pt_appointments")
          .select("id, user_id, starts_at, confirmation_status, status")
          .gte("starts_at", new Date().toISOString())
          .lte("starts_at", addDays(today, 14).toISOString())
          .not("status", "in", "(cancelled,late_cancel,no_show,completed)")
          .order("starts_at", { ascending: true });
        const list = (data ?? []).filter((a: any) => a.confirmation_status !== "confirmed");
        const names = await nameMapFor(list.map((a: any) => a.user_id));
        return list.map((a: any) => ({
          id: a.id,
          title: names.get(a.user_id) ?? "Client",
          subtitle: format(new Date(a.starts_at), "EEE, MMM d · h:mm a"),
          badge: a.confirmation_status === "tentative" ? "Tentative" : "Unconfirmed",
          tone: "amber",
          to: `/admin/pt/m/session/${a.id}`,
        }));
      }

      if (key === "packages-expiring") {
        const { data } = await (supabase as any).from("pt_passes")
          .select("id, user_id, pack_name, sessions_remaining, sessions_total, expires_at")
          .eq("status", "active");
        const list = (data ?? []).filter(
          (p: any) => (p.expires_at && p.expires_at <= soon) || (p.sessions_remaining ?? 0) <= 2);
        const names = await nameMapFor(list.map((p: any) => p.user_id));
        return list.map((p: any) => ({
          id: p.id,
          title: names.get(p.user_id) ?? "Client",
          subtitle: `${p.pack_name ?? "Package"} · ${p.sessions_remaining ?? 0}/${p.sessions_total ?? 0} left`,
          badge: p.expires_at ? `Exp ${format(new Date(p.expires_at), "MMM d")}` : "Low balance",
          tone: (p.sessions_remaining ?? 0) <= 1 ? "red" : "amber",
          to: `/admin/pt/clients/${p.user_id}`,
        }));
      }

      if (key === "reassessments") {
        const { data } = await (supabase as any).from("pt_programs")
          .select("id, user_id, name, next_reassessment")
          .eq("status", "active")
          .not("next_reassessment", "is", null)
          .lte("next_reassessment", soon)
          .order("next_reassessment", { ascending: true });
        const names = await nameMapFor((data ?? []).map((p: any) => p.user_id));
        return (data ?? []).map((p: any) => ({
          id: p.id,
          title: names.get(p.user_id) ?? "Client",
          subtitle: p.name ?? "Program",
          badge: format(new Date(p.next_reassessment), "MMM d"),
          tone: "gold",
          to: `/admin/pt/clients/${p.user_id}`,
        }));
      }

      // alerts + follow-ups
      const { data } = await (supabase as any).from("pt_alerts")
        .select("id, client_user_id, alert_type, message, severity, created_at")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false });
      const list = (data ?? []).filter((a: any) =>
        key === "follow-ups" ? a.alert_type === "follow_up" : a.alert_type !== "follow_up");
      const names = await nameMapFor(list.map((a: any) => a.client_user_id));
      return list.map((a: any) => ({
        id: a.id,
        title: names.get(a.client_user_id) ?? "Client",
        subtitle: a.message ?? String(a.alert_type ?? "").replace(/_/g, " "),
        badge: a.severity ?? undefined,
        tone: a.severity === "high" ? "red" : "amber",
        to: a.client_user_id ? `/admin/pt/clients/${a.client_user_id}` : undefined,
      }));
    },
  });

  const title = useMemo(() => TITLES[key] ?? "List", [key]);

  return (
    <PTMobileShell title={title} back>
      {isLoading ? (
        <PTMListSkeleton rows={5} />
      ) : isError ? (
        <PTMEmpty
          title="Couldn't load this list"
          description={(error as any)?.message ?? "Check your connection and try again."}
          action={
            <button
              onClick={() => refetch()}
              className="min-h-[44px] rounded-full border border-pt-line px-5 text-sm text-pt-ink"
            >
              Try again
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <PTMEmpty title="All clear" description={`Nothing in ${title.toLowerCase()} right now.`} />
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <PTMCard key={r.id} onClick={r.to ? () => navigate(r.to!) : undefined} className="bg-white p-3.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-pt-ink">{r.title}</p>
                  {r.subtitle && <p className="truncate text-[12px] text-pt-muted">{r.subtitle}</p>}
                </div>
                {r.badge && <PTMBadge tone={r.tone ?? "neutral"}>{r.badge}</PTMBadge>}
                {r.to && <ChevronRight className="h-4 w-4 shrink-0 text-pt-muted" />}
              </div>
            </PTMCard>
          ))}
        </div>
      )}
    </PTMobileShell>
  );
}
