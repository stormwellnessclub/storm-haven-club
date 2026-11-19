import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUsd } from "@/lib/blackFriday";

type Offer = { key: string; name: string; price_cents: number; classes: number; expiry_days: number; is_active: boolean; starts_at: string | null; ends_at: string | null; includes_day_pass: boolean; first_time_only: boolean };
type Purchase = { pass_id: string; offer_key: string; buyer_name: string | null; buyer_email: string | null; purchased_at: string; expires_at: string; classes_total: number; classes_remaining: number; price_paid: number; day_pass_id: string | null; day_pass_used_at: string | null; classes_booked: number };

const toLocal = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Detroit" }).slice(0, 16).replace(" ", "T") : "");
// Interpret the typed time as Detroit time.
const fromLocal = (v: string) => {
  if (!v) return null;
  const guess = new Date(`${v}:00Z`);
  const detroit = new Date(guess.toLocaleString("en-US", { timeZone: "America/Detroit" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (utc.getTime() - detroit.getTime())).toISOString();
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Detroit" });

export function SeasonalClassOffersTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const { data: offers = [] } = useQuery({
    queryKey: ["admin-seasonal-class-offers"],
    queryFn: async () => ((await (supabase as any).from("seasonal_class_offers").select("*").order("display_order")).data ?? []) as Offer[],
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-seasonal-class-purchases"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_seasonal_class_purchases");
      if (error) throw error;
      return (data ?? []) as Purchase[];
    },
  });

  async function save(key: string, patch: Partial<Offer>) {
    const { error } = await (supabase as any).from("seasonal_class_offers").update({ ...patch, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-seasonal-class-offers"] }); qc.invalidateQueries({ queryKey: ["seasonal-class-offers"] }); }
  }

  const name = (k: string) => offers.find((o) => o.key === k)?.name ?? k;
  const rows = useMemo(() => purchases.filter((p) => filter === "all" || p.offer_key === filter), [purchases, filter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">The Movement Edit packages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Shown on the Seasonal Edit page only while switched on and within its dates. Regular class pricing is not affected.</p>
          {offers.map((o) => {
            const sold = purchases.filter((p) => p.offer_key === o.key);
            return (
              <div key={o.key} className="grid gap-3 border-t pt-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{formatUsd(o.price_cents)} · {o.classes} classes · use within {o.expiry_days} days{o.includes_day_pass ? " · + 1 day pass" : ""}{o.first_time_only ? " · first-time guests, once" : " · non-members"}</p>
                  <p className="text-xs mt-1">{sold.length} sold · {formatUsd(Math.round(sold.reduce((s, p) => s + Number(p.price_paid), 0) * 100))} package revenue</p>
                </div>
                <div><Label className="text-xs">Starts (Detroit)</Label><Input type="datetime-local" defaultValue={toLocal(o.starts_at)} onBlur={(e) => e.target.value !== toLocal(o.starts_at) && save(o.key, { starts_at: fromLocal(e.target.value) })} /></div>
                <div><Label className="text-xs">Ends (Detroit)</Label><Input type="datetime-local" defaultValue={toLocal(o.ends_at)} onBlur={(e) => e.target.value !== toLocal(o.ends_at) && save(o.key, { ends_at: fromLocal(e.target.value) })} /></div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={o.is_active} onCheckedChange={(v) => save(o.key, { is_active: v })} />{o.is_active ? "On" : "Off"}</label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Purchases</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All packages</SelectItem>
              {offers.map((o) => <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No purchases yet.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2 pr-3">Client</th><th className="pr-3">Package</th><th className="pr-3">Bought</th><th className="pr-3">Classes left</th><th className="pr-3">Booked</th><th className="pr-3">Expires</th><th>Day pass</th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const expired = new Date(p.expires_at) < new Date();
                  return (
                    <tr key={p.pass_id} className="border-t">
                      <td className="py-2 pr-3"><div>{p.buyer_name ?? "—"}</div><div className="text-xs text-muted-foreground">{p.buyer_email}</div></td>
                      <td className="pr-3">{name(p.offer_key)}</td>
                      <td className="pr-3">{day(p.purchased_at)}</td>
                      <td className="pr-3">{p.classes_remaining} / {p.classes_total}</td>
                      <td className="pr-3">{p.classes_booked}</td>
                      <td className="pr-3">{day(p.expires_at)} {expired && <Badge variant="secondary">Expired</Badge>}</td>
                      <td>{!p.day_pass_id ? "—" : p.day_pass_used_at ? <Badge variant="secondary">Used {day(p.day_pass_used_at)}</Badge> : <Badge>Not used</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
