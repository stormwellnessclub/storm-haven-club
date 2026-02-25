import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, subDays, isBefore, isAfter } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar, Clock, Users, Dumbbell, XCircle,
  Eye, Loader2, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TempClassSchedule } from "@/components/booking/TempClassSchedule";
import { ClassRosterDialog } from "@/components/admin/ClassRosterDialog";
import {
  SOFT_LAUNCH_START, SOFT_LAUNCH_END,
  getClassesForDate, parseTimeToDb,
  type ClassEntry,
} from "@/lib/softLaunchSchedule";
import { ensureTempClassSession } from "@/lib/ensureTempClassSession";

// Represents a scheduled class slot from the hardcoded timetable, enriched with DB data
interface ScheduleSlot {
  entry: ClassEntry;
  dateStr: string;
  dbSessionId: string | null;
  enrolled: number;
  maxCapacity: number;
  isCancelled: boolean;
  isHidden: boolean;
}

export function SoftLaunchClassManagement() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const start = isBefore(today, SOFT_LAUNCH_START) ? SOFT_LAUNCH_START : isAfter(today, SOFT_LAUNCH_END) ? SOFT_LAUNCH_END : today;
    if (getClassesForDate(start).length > 0) return start;
    // Search forward then backward for nearest date with classes
    for (let i = 1; i <= 30; i++) {
      const fwd = addDays(start, i);
      if (!isAfter(fwd, SOFT_LAUNCH_END) && getClassesForDate(fwd).length > 0) return fwd;
      const bwd = subDays(start, i);
      if (!isBefore(bwd, SOFT_LAUNCH_START) && getClassesForDate(bwd).length > 0) return bwd;
    }
    return start;
  });
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelMode, setCancelMode] = useState<"visible" | "silent">("visible");
  const [refScheduleOpen, setRefScheduleOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const canGoPrev = !isBefore(subDays(selectedDate, 1), SOFT_LAUNCH_START);
  const canGoNext = !isAfter(addDays(selectedDate, 1), SOFT_LAUNCH_END);

  // Get the hardcoded classes for the selected date (source of truth)
  const hardcodedClasses = getClassesForDate(selectedDate);

  // Fetch DB sessions for overlay (enrollment data) — include cancelled ones too
  const { data: dbSessions = [], isLoading } = useQuery({
    queryKey: ['soft-launch-sessions', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select(`id, start_time, current_enrollment, max_capacity, is_cancelled, is_hidden, cancellation_reason, class_types!inner(name)`)
        .eq('session_date', dateStr)
        .in('class_types.name', ['Signature Flow', 'Reformer Flow', 'Reformer Sculpt']);
      if (error) throw error;
      return data || [];
    },
  });

  // Merge hardcoded schedule with DB data
  const slots: ScheduleSlot[] = hardcodedClasses
    .map((entry) => {
      const dbTime = parseTimeToDb(entry.time);
      const match = dbSessions.find((s: any) => {
        const typeName = Array.isArray(s.class_types) ? s.class_types[0]?.name : s.class_types?.name;
        return s.start_time === dbTime && typeName === entry.name;
      });
      return {
        entry,
        dateStr,
        dbSessionId: match?.id || null,
        enrolled: match?.current_enrollment || 0,
        maxCapacity: match?.max_capacity || 8,
        isCancelled: match?.is_cancelled || false,
        isHidden: match?.is_hidden || false,
      };
    });

  // Helper to ensure session exists for cancellation
  const ensureSessionForSlot = async (slot: ScheduleSlot): Promise<string> => {
    if (slot.dbSessionId) return slot.dbSessionId;

    return ensureTempClassSession({
      className: slot.entry.name,
      sessionDate: slot.dateStr,
      startTimeLabel: slot.entry.time,
      maxCapacity: 8,
    });
  };

  // Cancel session mutation — supports visible and silent modes
  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot) return;
      const sessionId = await ensureSessionForSlot(selectedSlot);

      if (cancelMode === "silent") {
        const { error } = await supabase
          .from('class_sessions')
          .update({ is_cancelled: true, is_hidden: true, cancellation_reason: cancellationReason || null })
          .eq('id', sessionId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('class_sessions')
          .update({ is_cancelled: true, is_hidden: false, cancellation_reason: cancellationReason || null })
          .eq('id', sessionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-sessions', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['temp-schedule-enrollment'] });
      setCancelDialogOpen(false);
      setCancellationReason("");
      setCancelMode("visible");
      setSelectedSlot(null);
      toast.success(cancelMode === "silent" ? "Class removed from schedule" : "Class cancelled");
    },
    onError: () => toast.error("Failed to cancel class"),
  });

  // Restore a hidden/cancelled session
  const restoreSessionMutation = useMutation({
    mutationFn: async (slot: ScheduleSlot) => {
      if (!slot.dbSessionId) throw new Error("No session to restore");
      const { error } = await supabase
        .from('class_sessions')
        .update({ is_cancelled: false, is_hidden: false, cancellation_reason: null })
        .eq('id', slot.dbSessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-sessions', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['temp-schedule-enrollment'] });
      toast.success("Class restored to schedule");
    },
    onError: () => toast.error("Failed to restore class"),
  });

  return (
    <div className="space-y-6">
      {/* Date Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" disabled={!canGoPrev} onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </div>
        <Button variant="outline" size="icon" disabled={!canGoNext} onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slots from hardcoded schedule */}
      {slots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No soft-launch classes on this date</p>
          <p className="text-sm mt-1">The soft-launch schedule runs Feb 20 – Mar 18, 2026.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot, idx) => (
            <Card
              key={`${slot.dateStr}-${slot.entry.time}-${slot.entry.name}`}
              className={`transition-colors hover:border-primary/50 ${slot.isCancelled && !slot.isHidden ? 'opacity-60 border-destructive/30' : ''} ${slot.isHidden ? 'opacity-50 border-muted' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className={`text-base ${slot.isCancelled || slot.isHidden ? 'line-through' : ''}`}>{slot.entry.name}</CardTitle>
                    <CardDescription>Duha · Reformer Studio</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {slot.isHidden && (
                      <Badge variant="outline" className="text-xs">Removed</Badge>
                    )}
                    {slot.isCancelled && !slot.isHidden && (
                      <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                    )}
                    <Badge variant="secondary">{slot.entry.time}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    50 min
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {slot.enrolled}/{slot.maxCapacity} enrolled
                </div>
                {(slot.isCancelled || slot.isHidden) ? (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() => { setSelectedSlot(slot); setRosterDialogOpen(true); }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View History
                    </Button>
                    {slot.dbSessionId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreSessionMutation.mutate(slot)}
                        disabled={restoreSessionMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() => { setSelectedSlot(slot); setRosterDialogOpen(true); }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {slot.enrolled > 0 ? 'View Roster' : 'Manage'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { setSelectedSlot(slot); setCancelDialogOpen(true); }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reference Schedule */}
      <Collapsible open={refScheduleOpen} onOpenChange={setRefScheduleOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground">
            Reference: Planned Timetable
            <ChevronRight className={`h-4 w-4 transition-transform ${refScheduleOpen ? 'rotate-90' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TempClassSchedule readOnly showHistory />
        </CollapsibleContent>
      </Collapsible>

      {/* Roster Dialog */}
      <ClassRosterDialog
        open={rosterDialogOpen}
        onOpenChange={setRosterDialogOpen}
        selectedSlot={selectedSlot}
        selectedDate={selectedDate}
        dateStr={dateStr}
      />

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {selectedSlot?.entry.name} at {selectedSlot?.entry.time}?
              {selectedSlot && selectedSlot.enrolled > 0 && (
                <span className="block mt-1 text-destructive font-medium">
                  ⚠️ {selectedSlot.enrolled} {selectedSlot.enrolled === 1 ? 'person is' : 'people are'} currently booked.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium">Cancellation Mode</Label>
              <RadioGroup value={cancelMode} onValueChange={(v) => setCancelMode(v as "visible" | "silent")} className="mt-2 space-y-2">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="visible" id="cancel-visible" className="mt-0.5" />
                  <div>
                    <Label htmlFor="cancel-visible" className="font-medium cursor-pointer">Show as cancelled</Label>
                    <p className="text-xs text-muted-foreground">Class stays on the schedule with a "Cancelled" badge visible to members.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="silent" id="cancel-silent" className="mt-0.5" />
                  <div>
                    <Label htmlFor="cancel-silent" className="font-medium cursor-pointer">Remove from schedule</Label>
                    <p className="text-xs text-muted-foreground">Class disappears entirely — members won't see it was ever scheduled.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="sl-reason">Cancellation Reason (optional)</Label>
              <Input
                id="sl-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Instructor unavailable"
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancellationReason(""); setCancelMode("visible"); setSelectedSlot(null); }}>
              Keep Class
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelSessionMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelSessionMutation.isPending}
            >
              {cancelSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {cancelMode === "silent" ? "Remove Class" : "Cancel Class"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}