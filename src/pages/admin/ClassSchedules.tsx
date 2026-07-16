import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Calendar, Loader2, RefreshCw, CalendarPlus, Info, Table2, LayoutGrid, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addWeeks } from "date-fns";
import { detectScheduleConflicts, checkNewScheduleConflicts } from "@/lib/scheduleConflicts";
import { ScheduleConflictPanel } from "@/components/admin/ScheduleConflictPanel";
import { WeeklyCalendarView } from "@/components/admin/WeeklyCalendarView";

interface ClassType {
  id: string;
  name: string;
  category: string;
}

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
}

interface ClassSchedule {
  id: string;
  class_type_id: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  max_capacity: number | null;
  is_active: boolean;
  is_invite_only?: boolean;
  is_one_time?: boolean;
  effective_from?: string | null;
  effective_until?: string | null;
  class_types?: ClassType;
  instructors?: Instructor | null;
}

type ScheduleMode = "ongoing" | "duration" | "one_time";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function ClassSchedules() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [weeksToGenerate, setWeeksToGenerate] = useState(4);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("calendar");
  const [hideInactive, setHideInactive] = useState(true);
  
  // Form state
  const [classTypeId, setClassTypeId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [room, setRoom] = useState("");
  const [maxCapacity, setMaxCapacity] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isInviteOnly, setIsInviteOnly] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("ongoing");
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");
  const [effectiveUntil, setEffectiveUntil] = useState<string>("");
  const [oneTimeDate, setOneTimeDate] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);


  // Fetch schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['class-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_schedules")
        .select(`
          *,
          class_types (id, name, category),
          instructors (id, first_name, last_name)
        `)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data as ClassSchedule[];
    },
  });

  // Fetch class types
  const { data: classTypes = [] } = useQuery({
    queryKey: ['class-types-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("id, name, category")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ClassType[];
    },
  });

  // Fetch instructors
  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data as Instructor[];
    },
  });

  // Fetch upcoming session count
  const { data: upcomingSessionCount = 0 } = useQuery({
    queryKey: ['upcoming-sessions-count'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count, error } = await supabase
        .from("class_sessions")
        .select("*", { count: 'exact', head: true })
        .gte("session_date", today)
        .eq("is_cancelled", false)
        .eq("is_hidden", false);
      if (error) throw error;
      return count || 0;
    },
  });

  function resetForm() {
    setClassTypeId("");
    setInstructorId("");
    setDayOfWeek(1);
    setStartTime("09:00");
    setEndTime("09:50");
    setRoom("");
    setMaxCapacity(null);
    setIsActive(true);
    setIsInviteOnly(false);
    setScheduleMode("ongoing");
    setEffectiveFrom("");
    setEffectiveUntil("");
    setOneTimeDate("");
    setFormError(null);
    setEditingSchedule(null);
  }


  function openEditDialog(schedule: ClassSchedule) {
    setEditingSchedule(schedule);
    setClassTypeId(schedule.class_type_id);
    setInstructorId(schedule.instructor_id || "");
    setDayOfWeek(schedule.day_of_week);
    setStartTime(schedule.start_time.slice(0, 5));
    setEndTime(schedule.end_time.slice(0, 5));
    setRoom(schedule.room || "");
    setMaxCapacity(schedule.max_capacity);
    setIsActive(schedule.is_active);
    setIsInviteOnly(!!schedule.is_invite_only);
    if (schedule.is_one_time) {
      setScheduleMode("one_time");
      setOneTimeDate(schedule.effective_from || "");
      setEffectiveFrom("");
      setEffectiveUntil("");
    } else if (schedule.effective_from || schedule.effective_until) {
      setScheduleMode("duration");
      setEffectiveFrom(schedule.effective_from || "");
      setEffectiveUntil(schedule.effective_until || "");
      setOneTimeDate("");
    } else {
      setScheduleMode("ongoing");
      setEffectiveFrom("");
      setEffectiveUntil("");
      setOneTimeDate("");
    }
    setDialogOpen(true);
  }

  // Create/Update schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!classTypeId) {
        throw new Error("Class type is required");
      }

      // Resolve effective window + day_of_week based on mode
      let resolvedDayOfWeek = dayOfWeek;
      let resolvedFrom: string | null = null;
      let resolvedUntil: string | null = null;
      const isOneTime = scheduleMode === "one_time";

      if (scheduleMode === "one_time") {
        if (!oneTimeDate) throw new Error("Please pick a date for the one-time class");
        // Derive day_of_week from the picked date (local)
        const [y, m, d] = oneTimeDate.split("-").map(Number);
        resolvedDayOfWeek = new Date(y, m - 1, d).getDay();
        resolvedFrom = oneTimeDate;
        resolvedUntil = oneTimeDate;
      } else if (scheduleMode === "duration") {
        if (!effectiveFrom || !effectiveUntil) {
          throw new Error("Please pick both a start and end date");
        }
        if (effectiveUntil < effectiveFrom) {
          throw new Error("End date must be on or after the start date");
        }
        resolvedFrom = effectiveFrom;
        resolvedUntil = effectiveUntil;
      }

      const scheduleData = {
        class_type_id: classTypeId,
        instructor_id: instructorId || null,
        day_of_week: resolvedDayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room: room.trim() || null,
        max_capacity: maxCapacity,
        is_active: isActive,
        is_invite_only: isInviteOnly,
        is_one_time: isOneTime,
        effective_from: resolvedFrom,
        effective_until: resolvedUntil,
      };

      // Pre-save conflict check (only for ongoing recurring rules to avoid
      // spurious warnings on dated / one-time entries).
      if (scheduleMode === "ongoing") {
        const warnings = checkNewScheduleConflicts(
          { ...scheduleData, id: editingSchedule?.id },
          schedules
        );
        if (warnings.length > 0) {
          throw new Error(warnings.join(". "));
        }
      }

      if (editingSchedule) {
        const { error } = await supabase
          .from("class_schedules")
          .update(scheduleData as any)
          .eq("id", editingSchedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_schedules")
          .insert([scheduleData as any]);
        if (error) throw error;
      }

      // Await reconciliation INSIDE the mutation so sessions are synced before onSuccess
      const today = format(new Date(), 'yyyy-MM-dd');
      const { error: reconcileError } = await supabase.rpc('reconcile_and_generate_class_sessions', {
        _start_date: today,
        _weeks_ahead: 6
      });
      if (reconcileError) {
        console.error('Reconciliation error:', reconcileError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-today'] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['public-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sessions-calendar'] });
      toast.success(editingSchedule ? "Schedule updated — sessions reconciled" : "Schedule created — sessions generated");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error('Schedule error:', error);
      setFormError(error.message || "Failed to save schedule");
      toast.error(error.message || "Failed to save schedule");
    },
  });


  // Generate + reconcile sessions mutation
  const generateSessionsMutation = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase.rpc('reconcile_and_generate_class_sessions', {
        _start_date: today,
        _weeks_ahead: weeksToGenerate
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-today'] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['public-schedule'] });
      const result = data?.[0];
      if (result) {
        const parts = [];
        if (result.sessions_created > 0) parts.push(`${result.sessions_created} created`);
        if (result.sessions_updated > 0) parts.push(`${result.sessions_updated} updated`);
        if (result.sessions_hidden > 0) parts.push(`${result.sessions_hidden} hidden`);
        if (result.sessions_skipped > 0) parts.push(`${result.sessions_skipped} unchanged`);
        toast.success(`Sessions reconciled: ${parts.join(', ')}`);
      } else {
        toast.success("Session reconciliation complete");
      }
      setGenerateDialogOpen(false);
    },
    onError: (error) => {
      console.error('Generate sessions error:', error);
      toast.error("Failed to reconcile sessions");
    },
  });

  function formatTime(time: string) {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  }

  const activeScheduleCount = schedules.filter(s => s.is_active).length;

  const conflicts = useMemo(() => detectScheduleConflicts(schedules), [schedules]);

  // Real-time inline warnings for the form
  const formWarnings = useMemo(() => {
    if (!classTypeId || !startTime || !endTime) return [];
    return checkNewScheduleConflicts(
      {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        instructor_id: instructorId || null,
        room: room.trim() || null,
        is_active: isActive,
        id: editingSchedule?.id,
      },
      schedules
    );
  }, [classTypeId, instructorId, dayOfWeek, startTime, endTime, room, isActive, editingSchedule, schedules]);

  function handleConflictEdit(scheduleId: string) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) openEditDialog(schedule);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Schedules</h1>
            <p className="text-muted-foreground">
              Manage recurring weekly class schedules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setGenerateDialogOpen(true)}
              disabled={activeScheduleCount === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconcile & Generate Sessions
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingSchedule ? "Edit Schedule" : "Add Schedule"}</DialogTitle>
                  <DialogDescription>
                    {editingSchedule ? "Update the schedule details." : "Add a recurring, time-limited, or one-time class."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="classType">Class Type</Label>
                    <Select value={classTypeId} onValueChange={setClassTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class type" />
                      </SelectTrigger>
                      <SelectContent>
                        {classTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>
                            {ct.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="instructor">Instructor</Label>
                    <Select 
                      value={instructorId || "none"} 
                      onValueChange={(v) => setInstructorId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select instructor (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No instructor assigned</SelectItem>
                        {instructors.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.first_name} {i.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Schedule type</Label>
                    <div className="grid grid-cols-3 gap-1 rounded-md border p-1 bg-muted/30">
                      {([
                        { v: "ongoing", label: "Recurring" },
                        { v: "duration", label: "For a period" },
                        { v: "one_time", label: "One-time" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setScheduleMode(opt.v)}
                          className={`text-xs px-2 py-1.5 rounded-sm font-medium transition-colors ${
                            scheduleMode === opt.v
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scheduleMode === "ongoing" && "Repeats every week on the chosen day until deactivated."}
                      {scheduleMode === "duration" && "Repeats every week on the chosen day between the start and end dates."}
                      {scheduleMode === "one_time" && "A single session on a specific date. Does not repeat."}
                    </p>
                  </div>

                  {scheduleMode === "one_time" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="oneTimeDate">Date</Label>
                      <Input
                        id="oneTimeDate"
                        type="date"
                        value={oneTimeDate}
                        onChange={(e) => setOneTimeDate(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="day">Day of Week</Label>
                        <Select value={dayOfWeek.toString()} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((d) => (
                              <SelectItem key={d.value} value={d.value.toString()}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {scheduleMode === "duration" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="effFrom">Start Date</Label>
                            <Input
                              id="effFrom"
                              type="date"
                              value={effectiveFrom}
                              onChange={(e) => setEffectiveFrom(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="effUntil">End Date</Label>
                            <Input
                              id="effUntil"
                              type="date"
                              value={effectiveUntil}
                              onChange={(e) => setEffectiveUntil(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="room">Room</Label>
                      <Input
                        id="room"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="e.g., Studio A"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="capacity">Max Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={maxCapacity || ""}
                        onChange={(e) => setMaxCapacity(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Default from class type"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Active</Label>
                    <Switch
                      id="active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-md border p-3 bg-muted/30">
                    <div className="space-y-0.5">
                      <Label htmlFor="invite-only">Invite only</Label>
                      <p className="text-xs text-muted-foreground">
                        Free for members. Only staff can add attendees — members can't self-book.
                      </p>
                    </div>
                    <Switch
                      id="invite-only"
                      checked={isInviteOnly}
                      onCheckedChange={setIsInviteOnly}
                    />
                  </div>
                  {/* Inline conflict warnings */}
                  {formWarnings.length > 0 && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Conflict{formWarnings.length > 1 ? "s" : ""} detected
                      </div>
                      {formWarnings.map((w, i) => (
                        <p key={i} className="text-xs text-destructive/80 pl-6">• {w}</p>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  {editingSchedule && (
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm("Delete this schedule? Future sessions from this schedule will be hidden.")) return;
                        try {
                          const { error } = await supabase
                            .from("class_schedules")
                            .delete()
                            .eq("id", editingSchedule.id);
                          if (error) throw error;
                          // Reconcile to hide orphaned sessions
                          const today = format(new Date(), 'yyyy-MM-dd');
                          await supabase.rpc('reconcile_and_generate_class_sessions', {
                            _start_date: today,
                            _weeks_ahead: 6
                          });
                          queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
                          queryClient.invalidateQueries({ queryKey: ['upcoming-sessions-count'] });
                          queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-today'] });
                          queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
                          queryClient.invalidateQueries({ queryKey: ['admin-sessions-calendar'] });
                          toast.success("Schedule deleted");
                          setDialogOpen(false);
                          resetForm();
                        } catch (err: any) {
                          toast.error(err.message || "Failed to delete schedule");
                        }
                      }}
                      className="sm:mr-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => { setFormError(null); scheduleMutation.mutate(); }}
                    disabled={scheduleMutation.isPending}
                  >

                    {scheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingSchedule ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Card */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeScheduleCount}</div>
              <p className="text-xs text-muted-foreground">
                Recurring weekly classes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Upcoming Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingSessionCount}</div>
              <p className="text-xs text-muted-foreground">
                Bookable class sessions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Generation Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{weeksToGenerate} weeks</div>
              <p className="text-xs text-muted-foreground">
                Until {format(addWeeks(new Date(), weeksToGenerate), 'MMM d, yyyy')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conflict Detector */}
        <ScheduleConflictPanel conflicts={conflicts} onEditSchedule={handleConflictEdit} />

        {/* Info Banner */}
        {activeScheduleCount > 0 && upcomingSessionCount === 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="flex items-center gap-3 py-4">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  No sessions generated yet
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Click "Generate Sessions" to create bookable class sessions from your schedules. 
                  Members will then be able to see and book these classes.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedules View */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>
                These recurring schedules define when classes happen each week
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-inactive"
                  checked={hideInactive}
                  onCheckedChange={setHideInactive}
                />
                <Label htmlFor="hide-inactive" className="text-sm text-muted-foreground cursor-pointer">
                  Hide inactive
                </Label>
              </div>
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "calendar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("calendar")}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Calendar
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  <Table2 className="h-4 w-4 mr-1" />
                  Table
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No schedules found</p>
                <p className="text-sm mt-1">Add your first schedule to get started.</p>
              </div>
            ) : viewMode === "calendar" ? (
              <WeeklyCalendarView
                schedules={hideInactive ? schedules.filter(s => s.is_active) : schedules}
                conflicts={conflicts}
                onEditSchedule={openEditDialog}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(hideInactive ? schedules.filter(s => s.is_active) : schedules).map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {DAYS_OF_WEEK.find((d) => d.value === schedule.day_of_week)?.label}
                      </TableCell>
                      <TableCell>
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </TableCell>
                      <TableCell>{schedule.class_types?.name || "—"}</TableCell>
                      <TableCell>
                        {schedule.instructors
                          ? `${schedule.instructors.first_name} ${schedule.instructors.last_name}`
                          : "—"}
                      </TableCell>
                      <TableCell>{schedule.room || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={schedule.is_active ? "default" : "secondary"}>
                            {schedule.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {schedule.is_one_time ? (
                            <Badge variant="outline" className="text-[10px]">
                              One-time{schedule.effective_from ? ` · ${format(new Date(schedule.effective_from + "T00:00:00"), "MMM d, yyyy")}` : ""}
                            </Badge>
                          ) : schedule.effective_until ? (
                            <Badge variant="outline" className="text-[10px]">
                              Thru {format(new Date(schedule.effective_until + "T00:00:00"), "MMM d")}
                            </Badge>
                          ) : schedule.effective_from ? (
                            <Badge variant="outline" className="text-[10px]">
                              From {format(new Date(schedule.effective_from + "T00:00:00"), "MMM d")}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(schedule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generate Sessions Dialog */}
      <AlertDialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Class Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              This will create bookable class sessions for the next {weeksToGenerate} weeks 
              based on your active schedules ({activeScheduleCount} schedules).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="weeks">Weeks to Generate</Label>
            <Select 
              value={weeksToGenerate.toString()} 
              onValueChange={(v) => setWeeksToGenerate(parseInt(v))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 week</SelectItem>
                <SelectItem value="2">2 weeks</SelectItem>
                <SelectItem value="4">4 weeks</SelectItem>
                <SelectItem value="6">6 weeks</SelectItem>
                <SelectItem value="8">8 weeks</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              Sessions will be created from today until {format(addWeeks(new Date(), weeksToGenerate), 'MMMM d, yyyy')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => generateSessionsMutation.mutate()}
              disabled={generateSessionsMutation.isPending}
            >
              {generateSessionsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Sessions
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
