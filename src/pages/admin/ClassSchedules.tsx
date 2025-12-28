import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  class_types?: ClassType;
  instructors?: Instructor | null;
}

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
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  
  // Form state
  const [classTypeId, setClassTypeId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [room, setRoom] = useState("");
  const [maxCapacity, setMaxCapacity] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [schedulesRes, classTypesRes, instructorsRes] = await Promise.all([
      supabase
        .from("class_schedules")
        .select(`
          *,
          class_types (id, name, category),
          instructors (id, first_name, last_name)
        `)
        .order("day_of_week")
        .order("start_time"),
      supabase.from("class_types").select("id, name, category").eq("is_active", true),
      supabase.from("instructors").select("id, first_name, last_name").eq("is_active", true),
    ]);

    if (schedulesRes.error) {
      toast.error("Failed to load schedules");
      console.error(schedulesRes.error);
    } else {
      setSchedules(schedulesRes.data || []);
    }

    if (!classTypesRes.error) setClassTypes(classTypesRes.data || []);
    if (!instructorsRes.error) setInstructors(instructorsRes.data || []);
    
    setLoading(false);
  }

  function resetForm() {
    setClassTypeId("");
    setInstructorId("");
    setDayOfWeek(1);
    setStartTime("09:00");
    setEndTime("09:50");
    setRoom("");
    setMaxCapacity(null);
    setIsActive(true);
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
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!classTypeId) {
      toast.error("Class type is required");
      return;
    }

    const scheduleData = {
      class_type_id: classTypeId,
      instructor_id: instructorId || null,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      room: room.trim() || null,
      max_capacity: maxCapacity,
      is_active: isActive,
    };

    if (editingSchedule) {
      const { error } = await supabase
        .from("class_schedules")
        .update(scheduleData)
        .eq("id", editingSchedule.id);
      
      if (error) {
        toast.error("Failed to update schedule");
        console.error(error);
      } else {
        toast.success("Schedule updated");
        setDialogOpen(false);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("class_schedules")
        .insert([scheduleData]);
      
      if (error) {
        toast.error("Failed to create schedule");
        console.error(error);
      } else {
        toast.success("Schedule created");
        setDialogOpen(false);
        resetForm();
        fetchData();
      }
    }
  }

  function formatTime(time: string) {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
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
                  {editingSchedule ? "Update the schedule details." : "Create a new recurring class schedule."}
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
                  <Select value={instructorId} onValueChange={setInstructorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select instructor (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No instructor assigned</SelectItem>
                      {instructors.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.first_name} {i.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingSchedule ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No schedules found. Add your first schedule to get started.</p>
              </div>
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
                  {schedules.map((schedule) => (
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
                        <Badge variant={schedule.is_active ? "default" : "secondary"}>
                          {schedule.is_active ? "Active" : "Inactive"}
                        </Badge>
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
    </AdminLayout>
  );
}
