import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRightLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  attendeeName: string;
  attendeeEmail?: string | null;
  currentSessionId: string;
  currentClassTypeId: string;
  currentClassName: string;
  currentDateLabel: string;
  currentTimeLabel: string;
  onMoved: () => void;
}

interface SessionOption {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_enrollment: number;
  room: string | null;
  class_type_id: string;
  class_type_name: string;
}

export function MoveBookingDialog({
  open,
  onOpenChange,
  bookingId,
  attendeeName,
  attendeeEmail,
  currentSessionId,
  currentClassTypeId,
  currentClassName,
  currentDateLabel,
  currentTimeLabel,
  onMoved,
}: Props) {
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["move-booking-sessions", currentClassTypeId, showAllTypes, open],
    enabled: open,
    queryFn: async (): Promise<SessionOption[]> => {
      const today = new Date();
      const todayIso = format(today, "yyyy-MM-dd");
      let q = supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, max_capacity, current_enrollment, room, class_type_id, class_types!inner(name)")
        .eq("is_cancelled", false)
        .eq("is_hidden", false)
        .gte("session_date", todayIso)
        .neq("id", currentSessionId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(100);
      if (!showAllTypes) q = q.eq("class_type_id", currentClassTypeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        session_date: r.session_date,
        start_time: r.start_time,
        end_time: r.end_time,
        max_capacity: r.max_capacity,
        current_enrollment: r.current_enrollment,
        room: r.room,
        class_type_id: r.class_type_id,
        class_type_name: Array.isArray(r.class_types) ? r.class_types[0]?.name : r.class_types?.name,
      }));
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (targetSessionId: string) => {
      const { data, error } = await supabase.rpc("move_class_booking", {
        p_booking_id: bookingId,
        p_target_session_id: targetSessionId,
      });
      if (error) throw error;

      // Best-effort email notification
      const target = sessions.find((s) => s.id === targetSessionId);
      if (attendeeEmail && target) {
        try {
          const newDateLabel = format(new Date(target.session_date + "T00:00:00"), "EEEE, MMMM d");
          const newTimeLabel = format(new Date(`2000-01-01T${target.start_time}`), "h:mm a");
          const bodyHtml = `
            <h2 style="margin:0 0 16px 0;color:#1C170F;">Your class was moved</h2>
            <p style="color:#1C170F;">Hi ${attendeeName.split(" ")[0] || "there"},</p>
            <p style="color:#1C170F;">Your booking has been moved to a new time. Your class credit stays on your account for this class.</p>
            <div style="background:#F6F0E7;padding:16px;border-radius:8px;margin:16px 0;">
              <p style="margin:0;color:#1C170F;"><strong>Was:</strong> ${currentClassName} — ${currentDateLabel} at ${currentTimeLabel}</p>
              <p style="margin:8px 0 0 0;color:#1C170F;"><strong>Now:</strong> ${target.class_type_name} — ${newDateLabel} at ${newTimeLabel}</p>
            </div>
            <p style="color:#1C170F;">If this time doesn't work, just reply to this email and we'll credit the class back to your account.</p>
            <p style="margin:24px 0 0 0;color:#1C170F;">— The Storm Wellness Club Team</p>
          `;
          await supabase.functions.invoke("send-email", {
            body: {
              type: "custom_message",
              to: attendeeEmail,
              data: {
                subject: "Your class was moved — Storm Wellness Club",
                bodyHtml,
                replyTo: "admin@stormwellnessclub.com",
              },
            },
          });
        } catch (e) {
          console.error("Move email failed (non-fatal):", e);
        }
      }
      return data;
    },
    onSuccess: () => {
      const target = sessions.find((s) => s.id === selectedId);
      const label = target
        ? `${format(new Date(target.session_date + "T00:00:00"), "MMM d")} ${format(new Date(`2000-01-01T${target.start_time}`), "h:mm a")}`
        : "new session";
      toast.success(`Moved to ${label} — credit kept, member notified`);
      onOpenChange(false);
      setSelectedId(null);
      onMoved();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to move booking"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Move {attendeeName}
          </DialogTitle>
          <DialogDescription>
            Current class: <strong>{currentClassName}</strong> — {currentDateLabel} at {currentTimeLabel}.
            The class credit or pass stays with the booking.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-3">
          <div className="text-sm text-muted-foreground">
            Showing {showAllTypes ? "all class types" : "same class type only"}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-all-types" className="text-sm">Show all class types</Label>
            <Switch id="show-all-types" checked={showAllTypes} onCheckedChange={setShowAllTypes} />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No other upcoming sessions found.</div>
          ) : (
            <div className="space-y-2 py-2">
              {sessions.map((s) => {
                const remaining = s.max_capacity - s.current_enrollment;
                const full = remaining <= 0;
                const isSelected = selectedId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={full}
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left border rounded-lg p-3 transition ${
                      isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border hover:bg-muted"
                    } ${full ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{s.class_type_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(s.session_date + "T00:00:00"), "EEE, MMM d")} · {format(new Date(`2000-01-01T${s.start_time}`), "h:mm a")}
                          {s.room ? ` · ${s.room}` : ""}
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${full ? "text-destructive" : "text-muted-foreground"}`}>
                        {full ? "Full" : `${remaining} of ${s.max_capacity} left`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={moveMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedId && moveMutation.mutate(selectedId)}
            disabled={!selectedId || moveMutation.isPending}
          >
            {moveMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Moving…</> : "Move booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
