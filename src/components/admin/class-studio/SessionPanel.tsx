import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, UserX, RotateCcw, ExternalLink, Loader2, Users, Clock, Eye, EyeOff, XCircle, Save,
} from "lucide-react";
import { resolveRosterIdentities, type RosterAttendee } from "@/hooks/useRosterIdentity";
import { formatTimeLabel, normalizeRoom, STUDIOS } from "@/lib/studios";
import {
  useStudioMutations, useInstructorsLite, type StudioSession,
} from "@/hooks/useClassStudio";

interface Props {
  session: StudioSession | null;
  onClose: () => void;
}

export function SessionPanel({ session, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { updateSession, cancelSession } = useStudioMutations();
  const { data: instructors = [] } = useInstructorsLite();

  const [capacity, setCapacity] = useState<number>(session?.max_capacity ?? 0);
  const [notes, setNotes] = useState<string>(session?.session_notes ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    setCapacity(session?.max_capacity ?? 0);
    setNotes(session?.session_notes ?? "");
    setCancelReason("");
    setShowCancel(false);
  }, [session?.id]);

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ["class-studio-roster", session?.id],
    enabled: !!session?.id,
    queryFn: () => resolveRosterIdentities(session!.id),
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ["class-studio-waitlist-list", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_waitlist")
        .select("id, position, status, user_id")
        .eq("session_id", session!.id)
        .eq("status", "waiting")
        .order("position");
      if (error) throw error;
      return data || [];
    },
  });

  if (!session) return null;

  const active = roster.filter((a) => !a.isCancelled);
  const cancelled = roster.filter((a) => a.isCancelled);
  const checkedIn = active.filter((a) => a.isCheckedIn).length;

  const refreshRoster = () => {
    qc.invalidateQueries({ queryKey: ["class-studio-roster", session.id] });
    qc.invalidateQueries({ queryKey: ["class-studio-sessions"] });
  };

  const setBookingStatus = async (a: RosterAttendee, status: "completed" | "no_show" | "confirmed") => {
    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (status === "completed") patch.checked_in_at = new Date().toISOString();
    if (status === "confirmed") patch.checked_in_at = null;
    const { error } = await supabase.from("class_bookings").update(patch).eq("id", a.bookingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      status === "completed" ? `${a.name} checked in` : status === "no_show" ? `${a.name} marked no-show` : "Check-in undone",
    );
    refreshRoster();
  };

  const saveDetails = async () => {
    await updateSession.mutateAsync({
      id: session.id,
      patch: { max_capacity: capacity, session_notes: notes.trim() || null },
    });
    toast.success("Class updated");
  };

  const changeInstructor = async (instructorId: string) => {
    await updateSession.mutateAsync({
      id: session.id,
      patch: { instructor_id: instructorId === "none" ? null : instructorId },
    });
    toast.success("Instructor updated for this date only");
  };

  const changeRoom = async (room: string) => {
    await updateSession.mutateAsync({ id: session.id, patch: { room } });
  };

  const isSub = !!session.schedule_id && !!session.instructor_id;

  return (
    <Sheet open={!!session} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg">{session.class_types?.name ?? "Class"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(session.session_date), "EEE MMM d")} · {formatTimeLabel(session.start_time)}–
            {formatTimeLabel(session.end_time)} · {normalizeRoom(session.room)}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant={session.current_enrollment >= session.max_capacity ? "destructive" : "secondary"}>
              <Users className="h-3 w-3 mr-1" />
              {session.current_enrollment}/{session.max_capacity}
            </Badge>
            {waitlist.length > 0 && <Badge variant="outline">Waitlist {waitlist.length}</Badge>}
            {session.is_hidden && !session.is_cancelled && <Badge variant="outline">Draft / hidden</Badge>}
            {session.is_cancelled && <Badge variant="destructive">Cancelled</Badge>}
            {session.is_invite_only && <Badge variant="outline">Invite only</Badge>}
          </div>
        </SheetHeader>

        <Tabs defaultValue="roster" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="roster">Roster ({active.length})</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist ({waitlist.length})</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-2 mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{checkedIn} checked in</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => navigate(`/admin/class-roster/${session.id}`)}
              >
                Full roster <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
            {rosterLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : active.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No one booked yet.</p>
            ) : (
              active.map((a) => (
                <div
                  key={a.bookingId}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.type.replace("_", " ")}
                      {a.checkedInAt ? ` · in ${format(new Date(a.checkedInAt), "h:mma")}` : ""}
                      {a.isNoShow ? " · no-show" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {a.isCheckedIn ? (
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setBookingStatus(a, "confirmed")}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="h-7" onClick={() => setBookingStatus(a, "completed")}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!a.isNoShow && (
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setBookingStatus(a, "no_show")}>
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
            {cancelled.length > 0 && (
              <div className="pt-2 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancelled</p>
                {cancelled.map((a) => (
                  <div
                    key={a.bookingId}
                    className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-1.5 opacity-60"
                  >
                    <span className="text-sm line-through truncate">{a.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {a.cancelType === "late" ? "Late" : "Early"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="waitlist" className="space-y-2 mt-3">
            {waitlist.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nobody waiting.</p>
            ) : (
              <>
                {waitlist.map((w: any, i: number) => (
                  <div key={w.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">Position {w.position ?? i + 1}</span>
                    <Badge variant="outline">waiting</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Promote a waitlisted guest from the full roster so credits and refunds stay correct.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate(`/admin/class-roster/${session.id}`)}>
                  Manage waitlist <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <Label>Instructor {isSub && <span className="text-xs text-muted-foreground">(this date only)</span>}</Label>
              <Select value={session.instructor_id ?? "none"} onValueChange={changeInstructor}>
                <SelectTrigger><SelectValue placeholder="Unstaffed" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unstaffed</SelectItem>
                  {instructors.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.first_name} {i.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changing this here substitutes for this date only — the recurring schedule keeps its instructor of record.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Studio</Label>
              <Select value={normalizeRoom(session.room)} onValueChange={changeRoom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDIOS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(Math.max(0, parseInt(e.target.value || "0", 10)))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Internal notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button onClick={saveDetails} disabled={updateSession.isPending} className="w-full">
              {updateSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save changes
            </Button>

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  updateSession.mutate({ id: session.id, patch: { is_hidden: !session.is_hidden } })
                }
              >
                {session.is_hidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                {session.is_hidden ? "Publish" : "Hide"}
              </Button>
              {!session.is_cancelled && (
                <Button variant="destructive" className="flex-1" onClick={() => setShowCancel((v) => !v)}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel class
                </Button>
              )}
            </div>

            {showCancel && (
              <div className="space-y-2 rounded-md border border-destructive/40 p-3">
                <Label>Reason (sent to booked members)</Label>
                <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Instructor illness" />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={cancelSession.isPending}
                  onClick={async () => {
                    await cancelSession.mutateAsync({
                      sessionId: session.id,
                      hide: true,
                      reason: cancelReason.trim() || "Cancelled by staff",
                    });
                    onClose();
                  }}
                >
                  {cancelSession.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm cancellation
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> All times shown in club time (America/Detroit).
            </p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
