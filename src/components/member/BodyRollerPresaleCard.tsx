import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

/** Member Credits + non-member Passes: shows the signed-in person's Body Roller presale sessions. */
export function BodyRollerPresaleCard() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["body-roller-presale-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: rows }, { data: s }] = await Promise.all([
        supabase.from("body_roller_presale_purchases")
          .select("id,label,sessions_total,sessions_used,expires_at,status")
          .eq("user_id", user!.id)
          .in("status", ["paid", "processing"])
          .order("created_at", { ascending: false }),
        supabase.from("body_roller_presale_settings").select("ends_at, booking_open").eq("id", 1).maybeSingle(),
      ]);
      return { rows: rows ?? [], settings: s };
    },
  });
  if (!data) return null;
  const open = data.settings && new Date(data.settings.ends_at).getTime() > Date.now();
  if (!data.rows.length && !open) return null;

  return (
    <Card className="border-accent/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <CardTitle className="text-lg">Lymphatic Body Roller</CardTitle>
        </div>
        <CardDescription>
          {data.rows.length
            ? data.settings?.booking_open ? "Your sessions are ready to book." : "Reserved. Booking opens when the machine arrives (estimated early November)."
            : "Presale pricing is open now."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-border/50 pb-2 text-sm">
            <div>
              <p className="font-medium">Body Roller — {r.label}</p>
              {r.status === "processing"
                ? <p className="text-xs text-muted-foreground">Bank payment clearing — usually 3–5 business days</p>
                : r.expires_at && <p className="text-xs text-muted-foreground">Expires {new Date(r.expires_at).toLocaleDateString("en-US", { timeZone: "America/Detroit" })}</p>}
            </div>
            <Badge variant={r.status === "processing" ? "outline" : "secondary"}>
              {r.status === "processing" ? "Processing" : `${r.sessions_total - r.sessions_used} of ${r.sessions_total} ${data.settings?.booking_open ? "left" : "reserved"}`}
            </Badge>
          </div>
        ))}
        {open && <Button asChild variant="outline" size="sm"><Link to="/body-roller-presale">{data.rows.length ? "Reserve more" : "See presale pricing"}</Link></Button>}
      </CardContent>
    </Card>
  );
}
