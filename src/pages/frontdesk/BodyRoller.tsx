import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FrontDeskShell } from "./FrontDeskShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { PRESALE_OPTIONS, NON_MEMBER_OPTIONS, usd } from "@/lib/bodyRollerPresale";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric" }) : "—";

export default function FrontDeskBodyRollerPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["frontdesk-body-roller-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_roller_presale_purchases")
        .select("id, customer_name, customer_email, label, member_id, sessions_total, sessions_used, total_cents, paid_at, expires_at")
        .eq("status", "paid")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !s || `${r.customer_name ?? ""} ${r.customer_email}`.toLowerCase().includes(s));
  }, [data, q]);

  const copyLink = () => {
    navigator.clipboard.writeText("https://stormwellnessclub.com/body-roller-presale");
    toast.success("Presale link copied");
  };

  return (
    <FrontDeskShell>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Lymphatic Body Roller — Presale</CardTitle>
              <CardDescription>Machine arriving early November. Everything purchased expires 6 months after purchase.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={copyLink}><Copy className="h-4 w-4 mr-2" />Copy presale link</Button>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium mb-2">Member presale (active members)</p>
              {PRESALE_OPTIONS.map((o) => (
                <div key={o.key} className="flex justify-between py-1 border-b border-border/50">
                  <span>{o.label}</span>
                  <span><span className="line-through text-muted-foreground mr-2">{usd(o.regular_cents)}</span>{usd(o.cents)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium mb-2">Non-members (regular price)</p>
              {NON_MEMBER_OPTIONS.map((o) => (
                <div key={o.key} className="flex justify-between py-1 border-b border-border/50">
                  <span>{o.short}</span><span>{usd(o.cents)}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-3">6% Michigan tax and card fee are added at checkout. Guests buy online from the presale page.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Who has reserved sessions</CardTitle>
            <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mt-2" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No presale purchases yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{r.customer_name || r.customer_email}</p>
                      <p className="text-xs text-muted-foreground">{r.customer_email} · {r.label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.member_id ? "default" : "secondary"}>{r.member_id ? "Member" : "Non-member"}</Badge>
                      <span><strong>{r.sessions_total - r.sessions_used}</strong> of {r.sessions_total} left</span>
                      <span className="text-muted-foreground">Expires {fmt(r.expires_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FrontDeskShell>
  );
}
