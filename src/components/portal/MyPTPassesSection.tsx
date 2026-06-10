import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell } from "lucide-react";
import { format as fmtDate, parseISO, differenceInDays } from "date-fns";
import { PT_FORMAT_LABEL, PtPass } from "@/lib/ptFormat";

export function MyPTPassesSection() {
  const { user } = useAuth();
  const { data: passes = [] } = useQuery({
    queryKey: ["my-pt-passes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select("*")
        .eq("user_id", user!.id)
        .in("status", ["active", "exhausted", "expired"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PtPass[];
    },
  });

  if (passes.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Dumbbell className="h-5 w-5" /> My Personal Training
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {passes.map((p) => {
          const exp = parseISO(p.expires_at);
          const days = differenceInDays(exp, new Date());
          const expSoon = p.status === "active" && days <= 14;
          return (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-medium">{PT_FORMAT_LABEL[p.format]}</div>
                    <div className="text-xs text-muted-foreground">{p.pack_name}</div>
                  </div>
                  <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">
                    {p.status}
                  </Badge>
                </div>
                <div className="text-2xl font-semibold mt-2">
                  {p.sessions_remaining}<span className="text-base text-muted-foreground">/{p.sessions_total} sessions</span>
                </div>
                <div className={`text-xs mt-1 ${expSoon ? "text-destructive" : "text-muted-foreground"}`}>
                  Expires {fmtDate(exp, "MMM d, yyyy")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
