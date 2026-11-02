import { useQuery } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useKioskCheckIn } from "@/hooks/useKioskCheckIn";

// ─── Today's Personal Training ─────────────────────────────────────
export function TodaysPT() {
  const { checkInPt, isCheckingIn } = useKioskCheckIn();
  const { data: sessions, refetch } = useQuery({
    queryKey: ["kiosk-todays-pt"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("kiosk_todays_pt");
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Dumbbell className="h-5 w-5" /> Today's Personal Training
          {sessions && sessions.length > 0 && <Badge variant="secondary" className="ml-auto">{sessions.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {s.name} <span className="text-xs text-muted-foreground">({s.is_member ? "Member" : "Non-member"})</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {fmt(s.starts_at)} – {fmt(s.ends_at)}{s.trainer ? ` • ${s.trainer}` : ""}{s.location ? ` • ${s.location}` : ""}
                  </p>
                </div>
                {s.checked_in_at ? (
                  <Badge variant="secondary" className="shrink-0">Checked in {fmt(s.checked_in_at)}</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={isCheckingIn}
                    onClick={async () => {
                      if (await checkInPt(s.id)) { toast.success(`${s.name} checked in for personal training!`); refetch(); }
                    }}
                  >
                    Check in
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No personal training sessions today</p>
        )}
      </CardContent>
    </Card>
  );
}

