import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePersonActivity } from "@/hooks/usePersonActivity";
import { format } from "date-fns";
import { Activity } from "lucide-react";

const d = (v: string | null) => (v ? format(new Date(v.length === 10 ? v + "T12:00:00" : v), "MMM d, yyyy") : "—");

/** What this person does at the club: classes, spa, recovery, café, PT. */
export function PersonActivityCard({ email }: { email?: string | null }) {
  const { data: people, isLoading, error } = usePersonActivity(!!email);
  const { data: types = [] } = useQuery({
    queryKey: ["class-types-min"],
    queryFn: async () => (await supabase.from("class_types").select("id, name").order("name")).data ?? [],
  });
  if (!email || error) return null;
  const p = people?.find((x) => x.email === email.trim().toLowerCase());
  const names = (p?.class_type_ids ?? []).map((id) => types.find((t: any) => t.id === id)?.name).filter(Boolean);
  const stat = (label: string, n: number | string, sub: string) => (
    <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold">{n}</div><div className="text-[11px] text-muted-foreground">{sub}</div></div>
  );
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Activity</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !p ? <p className="text-sm text-muted-foreground">No activity found.</p> : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {stat("Classes", p.class_count, `${p.class_90d} in 90 days · last ${d(p.last_class_date)}`)}
              {stat("Massages", p.massage_count, `${p.spa_count} spa total · last ${d(p.last_spa_date)}`)}
              {stat("Recovery", p.recovery_count, `last ${d(p.last_recovery_at)}`)}
              {stat("Café", p.cafe_count, `$${Number(p.cafe_spend).toFixed(2)} · last ${d(p.last_cafe_at)}`)}
              {stat("Personal training", p.pt_count, `last ${d(p.last_pt_at)}`)}
              {stat("Body Roller", p.body_roller_sessions, `last check-in ${d(p.last_checkin_at)}`)}
            </div>
            {names.length > 0 && <p className="text-xs text-muted-foreground">Class types: {names.join(", ")}</p>}
            <p className="text-xs text-muted-foreground">Texts: {p.sms_opt_in ? "agreed" : "not agreed"}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
