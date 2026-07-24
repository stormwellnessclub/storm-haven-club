import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Calendar,
  Clock,
  Users,
  Flame,
  Snowflake,
  Pause,
  Play,
  Loader2,
  CalendarPlus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addWeeks } from "date-fns";
import { ClassReviewsList } from "@/components/reviews/ClassReviewsList";
import { useClassTypeRatings } from "@/hooks/useClassReviews";

interface ClassType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  max_capacity: number;
  is_heated: boolean;
  is_signature: boolean;
  is_active: boolean;
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
  instructors?: Instructor | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const CATEGORY_LABELS: Record<string, string> = {
  reformer: "Reformer Studio",
  cycling: "Cycling Studio",
  aerobics: "Aerobics Studio",
  pilates_cycling: "Pilates & Cycling",
  other: "Other",
};

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}

export default function ClassTypeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  
  // Edit class type form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("aerobics");
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [maxCapacity, setMaxCapacity] = useState(20);
  const [isHeated, setIsHeated] = useState(false);
  const [isSignature, setIsSignature] = useState(false);
  const [isActive, setIsActive] = useState(true);
  
  // Schedule form state
  const [instructorId, setInstructorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [room, setRoom] = useState("");
  const [scheduleCapacity, setScheduleCapacity] = useState<number | null>(null);
  const [scheduleIsActive, setScheduleIsActive] = useState(true);

  // Fetch class type details
  const { data: classType, isLoading: typeLoading } = useQuery({
    queryKey: ['class-type-detail', id],
    queryFn: async () => {
      if (!id) throw new Error("No ID provided");
      const { data, error } = await supabase
        .from("class_types")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ClassType;
    },
    enabled: !!id,
  });

  // Fetch schedules for this class type
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['class-schedules-for-type', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("class_schedules")
        .select(`
          *,
          instructors (id, first_name, last_name)
        `)
        .eq("class_type_id", id)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data as ClassSchedule[];
    },
    enabled: !!id,
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

  // Fetch session stats
  const { data: sessionStats } = useQuery({
    queryKey: ['session-stats-for-type', id],
    queryFn: async () => {
      if (!id) return { today: 0, thisWeek: 0, upcoming: 0 };
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekEnd = format(addWeeks(new Date(), 1), 'yyyy-MM-dd');
      const monthEnd = format(addWeeks(new Date(), 4), 'yyyy-MM-dd');
      
      const [todayRes, weekRes, upcomingRes] = await Promise.all([
        supabase.from("class_sessions").select("*", { count: 'exact', head: true })
          .eq("class_type_id", id).eq("session_date", today).eq("is_cancelled", false),
        supabase.from("class_sessions").select("*", { count: 'exact', head: true })
          .eq("class_type_id", id).gte("session_date", today).lt("session_date", weekEnd).eq("is_cancelled", false),
        supabase.from("class_sessions").select("*", { count: 'exact', head: true })
          .eq("class_type_id", id).gte("session_date", today).lt("session_date", monthEnd).eq("is_cancelled", false),
      ]);
      
      return {
        today: todayRes.count || 0,
        thisWeek: weekRes.count || 0,
        upcoming: upcomingRes.count || 0,
      };
    },
    enabled: !!id,
  });

  const { data: ratingsMap } = useClassTypeRatings();
  const ratingSummary = id ? ratingsMap?.[id] : undefined;

  // Update class type mutation

  const updateTypeMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No ID");
      const { error } = await supabase
        .from("class_types")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          category: category as any,
          duration_minutes: durationMinutes,
          max_capacity: maxCapacity,
          is_heated: isHeated,
          is_signature: isSignature,
          is_active: isActive,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-type-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['class-types-grouped'] });
      toast.success("Class type updated");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to update class type");
    },
  });

  // Schedule mutation (create/update)
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const scheduleData = {
        class_type_id: id!,
        instructor_id: instructorId || null,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room: room.trim() || null,
        max_capacity: scheduleCapacity,
        is_active: scheduleIsActive,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from("class_schedules")
          .update(scheduleData)
          .eq("id", editingSchedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_schedules")
          .insert([scheduleData]);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      // Reconcile future sessions so they match the updated schedule
      try {
        await supabase.functions.invoke("process-session-generation", {
          body: { weeks_ahead: 4 },
        });
      } catch (e) {
        console.error("Reconciliation after schedule save failed:", e);
      }
      queryClient.invalidateQueries({ queryKey: ['class-schedules-for-type', id] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] });
      queryClient.invalidateQueries({ queryKey: ['session-stats-for-type', id] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      toast.success(editingSchedule ? "Schedule updated" : "Schedule added");
      setScheduleDialogOpen(false);
      resetScheduleForm();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to save schedule");
    },
  });

  // Toggle schedule active status
  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ scheduleId, isActive }: { scheduleId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("class_schedules")
        .update({ is_active: isActive })
        .eq("id", scheduleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      try {
        await supabase.functions.invoke("process-session-generation", {
          body: { weeks_ahead: 4 },
        });
      } catch (e) {
        console.error("Reconciliation after toggle failed:", e);
      }
      queryClient.invalidateQueries({ queryKey: ['class-schedules-for-type', id] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] });
      queryClient.invalidateQueries({ queryKey: ['session-stats-for-type', id] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      toast.success("Schedule status updated");
    },
    onError: () => {
      toast.error("Failed to update schedule");
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("class_schedules")
        .delete()
        .eq("id", scheduleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      try {
        await supabase.functions.invoke("process-session-generation", {
          body: { weeks_ahead: 4 },
        });
      } catch (e) {
        console.error("Reconciliation after delete failed:", e);
      }
      queryClient.invalidateQueries({ queryKey: ['class-schedules-for-type', id] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-classes'] });
      queryClient.invalidateQueries({ queryKey: ['session-stats-for-type', id] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      toast.success("Schedule deleted");
    },
    onError: () => {
      toast.error("Failed to delete schedule");
    },
  });

  function resetScheduleForm() {
    setInstructorId("");
    setDayOfWeek(1);
    setStartTime("09:00");
    setEndTime("09:50");
    setRoom("");
    setScheduleCapacity(null);
    setScheduleIsActive(true);
    setEditingSchedule(null);
  }

  function openEditTypeDialog() {
    if (!classType) return;
    setName(classType.name);
    setDescription(classType.description || "");
    setCategory(classType.category);
    setDurationMinutes(classType.duration_minutes);
    setMaxCapacity(classType.max_capacity);
    setIsHeated(classType.is_heated);
    setIsSignature(classType.is_signature);
    setIsActive(classType.is_active);
    setEditDialogOpen(true);
  }

  function openAddScheduleDialog() {
    resetScheduleForm();
    setScheduleDialogOpen(true);
  }

  function openEditScheduleDialog(schedule: ClassSchedule) {
    setEditingSchedule(schedule);
    setInstructorId(schedule.instructor_id || "");
    setDayOfWeek(schedule.day_of_week);
    setStartTime(schedule.start_time.slice(0, 5));
    setEndTime(schedule.end_time.slice(0, 5));
    setRoom(schedule.room || "");
    setScheduleCapacity(schedule.max_capacity);
    setScheduleIsActive(schedule.is_active);
    setScheduleDialogOpen(true);
  }

  const activeScheduleCount = schedules.filter(s => s.is_active).length;

  if (typeLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!classType) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Class type not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/class-types')}>
            Back to Class Types
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/class-types">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Class Types
            </Link>
          </Button>
        </div>

        {/* Class Type Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{classType.name}</CardTitle>
                <Badge variant={classType.is_active ? "default" : "secondary"}>
                  {classType.is_active ? "Active" : "Inactive"}
                </Badge>
                {classType.is_heated && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    <Flame className="h-3 w-3 mr-1" />
                    Heated
                  </Badge>
                )}
                {classType.is_signature && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-700 text-white border-0">
                    👑 Signature
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                {CATEGORY_LABELS[classType.category] || classType.category}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openEditTypeDialog}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm(`Delete class type "${classType.name}"?\n\nThis will remove its recurring schedules and future empty sessions. If historical bookings exist, it will be deactivated instead to preserve history.`)) return;
                  const { data, error } = await supabase.rpc('delete_class_type', { _class_type_id: classType.id, _force: false });
                  if (error) { toast.error(error.message); return; }
                  const res = data as any;
                  if (res?.status === 'blocked') {
                    toast.error(res.message || 'Cannot delete');
                    return;
                  }
                  if (res?.status === 'deactivated') {
                    toast.success(res.message || 'Deactivated');
                    queryClient.invalidateQueries({ queryKey: ['class-type'] });
                    queryClient.invalidateQueries({ queryKey: ['class-types'] });
                    return;
                  }
                  toast.success(`Deleted "${res?.name || classType.name}"`);
                  queryClient.invalidateQueries({ queryKey: ['class-types'] });
                  navigate('/admin/class-types');
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-medium">{classType.duration_minutes} min</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Default Capacity</p>
                <p className="text-lg font-medium">{classType.max_capacity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Schedules</p>
                <p className="text-lg font-medium">{activeScheduleCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-lg font-medium">{sessionStats?.thisWeek || 0} sessions</p>
              </div>
            </div>
            {classType.description && (
              <p className="mt-4 text-muted-foreground">{classType.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Recurring Schedules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recurring Schedules</CardTitle>
              <CardDescription>
                Weekly patterns that generate bookable sessions
              </CardDescription>
            </div>
            <Button onClick={openAddScheduleDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No schedules yet</p>
                <p className="text-sm">Add a schedule to start generating sessions</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id} className={!schedule.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        {DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {schedule.instructors 
                          ? `${schedule.instructors.first_name} ${schedule.instructors.last_name}`
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        {schedule.room || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {schedule.max_capacity || classType.max_capacity}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={schedule.is_active ? "default" : "secondary"}>
                          {schedule.is_active ? "Active" : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditScheduleDialog(schedule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleScheduleMutation.mutate({ 
                              scheduleId: schedule.id, 
                              isActive: !schedule.is_active 
                            })}
                          >
                            {schedule.is_active ? (
                              <Pause className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Play className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this schedule? Future sessions will not be affected.")) {
                                deleteScheduleMutation.mutate(schedule.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Sessions Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>
                Generated from recurring schedules
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/classes">
                <Calendar className="h-4 w-4 mr-2" />
                View Session Calendar
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{sessionStats?.today || 0}</p>
                <p className="text-sm text-muted-foreground">Today</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{sessionStats?.thisWeek || 0}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{sessionStats?.upcoming || 0}</p>
                <p className="text-sm text-muted-foreground">Next 4 Weeks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Member Reviews */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Member Reviews</CardTitle>
                <CardDescription>
                  All ratings and reviews submitted for this class. Hide a review to remove it from public view.
                </CardDescription>
              </div>
              {ratingSummary && ratingSummary.review_count > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold">{ratingSummary.average_rating.toFixed(1)} ★</div>
                  <div className="text-xs text-muted-foreground">
                    {ratingSummary.review_count} review{ratingSummary.review_count !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ClassReviewsList classTypeId={classType.id} isAdmin />
          </CardContent>
        </Card>
      </div>

      {/* Edit Class Type Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Class Type</DialogTitle>
            <DialogDescription>Update the class type details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reformer">Reformer Studio</SelectItem>
                    <SelectItem value="cycling">Cycling Studio</SelectItem>
                    <SelectItem value="aerobics">Aerobics Studio</SelectItem>
                    <SelectItem value="pilates_cycling">Pilates & Cycling</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 50)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Max Capacity</Label>
              <Input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 20)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Heated Class</Label>
              <Switch checked={isHeated} onCheckedChange={setIsHeated} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <div>
                <Label>👑 Signature Class</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Featured in Signature tab</p>
              </div>
              <Switch checked={isSignature} onCheckedChange={setIsSignature} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => updateTypeMutation.mutate()} disabled={updateTypeMutation.isPending}>
              {updateTypeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
        setScheduleDialogOpen(open);
        if (!open) resetScheduleForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Edit Schedule" : "Add Schedule"}</DialogTitle>
            <DialogDescription>
              {editingSchedule ? "Update this recurring schedule" : "Create a new recurring weekly schedule"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Day of Week</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Instructor</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Room</Label>
                <Input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g., Studio A"
                />
              </div>
              <div className="grid gap-2">
                <Label>Max Capacity</Label>
                <Input
                  type="number"
                  value={scheduleCapacity || ""}
                  onChange={(e) => setScheduleCapacity(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder={`Default: ${classType.max_capacity}`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={scheduleIsActive} onCheckedChange={setScheduleIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? "Update" : "Add Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
