import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

interface OrphanRow {
  id: string;
  session_date: string;
  start_time: string;
  class_types: { name: string } | null;
  booking_count: number;
}

export function OrphanSessionsPanel() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: orphans = [] } = useQuery({
    queryKey: ["orphan-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, class_types(name)")
        .is("schedule_id", null)
        .gte("session_date", new Date().toISOString().slice(0, 10))
        .eq("is_cancelled", false)
        .eq("is_hidden", false)
        .order("session_date", { ascending: true });
      if (error) throw error;

      // Fetch booking counts in parallel
      const ids = (data || []).map((s) => s.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: bookings } = await supabase
          .from("class_bookings")
          .select("session_id")
          .in("session_id", ids)
          .eq("status", "confirmed");
        for (const b of bookings || []) {
          counts[b.session_id] = (counts[b.session_id] || 0) + 1;
        }
      }
      return (data || []).map((r) => ({
        ...r,
        booking_count: counts[r.id] || 0,
      })) as OrphanRow[];
    },
    refetchInterval: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orphan session removed");
      queryClient.invalidateQueries({ queryKey: ["orphan-sessions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  if (orphans.length === 0) return null;

  return (
    <Card className="border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/10">
      <div className="p-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-start gap-3 text-left"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">
                {orphans.length} orphan session{orphans.length === 1 ? "" : "s"} on the public schedule
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {expanded ? "Hide" : "Review"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              These sessions are visible to members but aren't tied to any active schedule. Delete any you don't want on the calendar.
            </p>
          </div>
        </button>

        {expanded && (
          <div className="mt-3 border-t border-amber-400/30 pt-3 space-y-1.5 max-h-72 overflow-y-auto">
            {orphans.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded bg-background/60 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate">
                    {o.class_types?.name || "Unknown class"}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {format(parseISO(o.session_date), "EEE, MMM d")} · {o.start_time.slice(0, 5)}
                  </span>
                  {o.booking_count > 0 && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {o.booking_count} booked
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive hover:bg-destructive/10"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (o.booking_count > 0) {
                      if (
                        !confirm(
                          `This session has ${o.booking_count} confirmed booking(s). Deleting will remove attendees. Continue?`
                        )
                      )
                        return;
                    }
                    deleteMutation.mutate(o.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
