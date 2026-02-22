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
  Eye, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TempClassSchedule } from "@/components/booking/TempClassSchedule";
import { ClassRosterDialog } from "@/components/admin/ClassRosterDialog";
import {
  SOFT_LAUNCH_START, SOFT_LAUNCH_END,
  getClassesForDate, parseTimeToDb,
  type ClassEntry,
} from "@/lib/softLaunchSchedule";

// Represents a scheduled class slot from the hardcoded timetable, enriched with DB data
interface ScheduleSlot {
  entry: ClassEntry;
  dateStr: string;
  dbSessionId: string | null;
  enrolled: number;
  maxCapacity: number;
  isCancelled: boolean;
}

export function SoftLaunchClassManagement() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    if (isBefore(today, SOFT_LAUNCH_START)) return SOFT_LAUNCH_START;
    if (isAfter(today, SOFT_LAUNCH_END)) return SOFT_LAUNCH_END;
    return today;
  });
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [refScheduleOpen, setRefScheduleOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const canGoPrev = !isBefore(subDays(selectedDate, 1), SOFT_LAUNCH_START);
  const canGoNext = !isAfter(addDays(selectedDate, 1), SOFT_LAUNCH_END);

  // Get the hardcoded classes for the selected date (source of truth)
  const hardcodedClasses = getClassesForDate(selectedDate);

  // Fetch DB sessions for overlay (enrollment data)
  const { data: dbSessions = [], isLoading } = useQuery({
    queryKey: ['soft-launch-sessions', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select(`id, start_time, current_enrollment, max_capacity, is_cancelled, cancellation_reason, class_types!inner(name)`)
        .eq('session_date', dateStr)
        .eq('is_cancelled', false)
        .in('class_types.name', ['Signature Flow', 'Reformer Flow', 'Reformer Sculpt']);
      if (error) throw error;
      return data || [];
    },
  });

  // Merge hardcoded schedule with DB data
  const slots: ScheduleSlot[] = hardcodedClasses.map((entry) => {
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
    };
  });

  // Cancel session mutation
  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot?.dbSessionId) return;
      const { error } = await supabase
        .from('class_sessions')
        .update({ is_cancelled: true, cancellation_reason: cancellationReason || null })
        .eq('id', selectedSlot.dbSessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soft-launch-sessions', dateStr] });
      setCancelDialogOpen(false);
      setCancellationReason("");
      setSelectedSlot(null);
      toast.success("Class cancelled");
    },
    onError: () => toast.error("Failed to cancel class"),
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
              className={`transition-colors hover:border-primary/50 ${slot.isCancelled ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{slot.entry.name}</CardTitle>
                    <CardDescription>Duha · Reformer Studio</CardDescription>
                  </div>
                  <Badge variant="secondary">{slot.entry.time}</Badge>
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
                {!slot.isCancelled && (
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
                    {slot.dbSessionId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setSelectedSlot(slot); setCancelDialogOpen(true); }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
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
          <TempClassSchedule readOnly />
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="sl-reason">Cancellation Reason (optional)</Label>
            <Input
              id="sl-reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g., Instructor unavailable"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setCancellationReason(""); setSelectedSlot(null); }}>
              Keep Class
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelSessionMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelSessionMutation.isPending}
            >
              {cancelSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
