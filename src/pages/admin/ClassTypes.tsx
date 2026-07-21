import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Plus, Loader2, Dumbbell, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClassTypeCard } from "@/components/admin/ClassTypeCard";
import { format, addWeeks } from "date-fns";

interface ClassType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  max_capacity: number;
  is_heated: boolean;
  is_active: boolean;
}

interface ClassSchedule {
  id: string;
  class_type_id: string;
  is_active: boolean;
}

interface Instructor {
  id: string;
  first_name: string;
  last_name: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; order: number }> = {
  pilates_cycling: { label: "Pilates & Cycling", order: 1 },
  reformer: { label: "Reformer Studio", order: 2 },
  cycling: { label: "Cycling Studio", order: 3 },
  aerobics: { label: "Aerobics & Fitness", order: 4 },
  other: { label: "Other", order: 5 },
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function ClassTypes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [addTypeDialogOpen, setAddTypeDialogOpen] = useState(false);
  const [quickScheduleDialogOpen, setQuickScheduleDialogOpen] = useState(false);
  const [selectedClassTypeId, setSelectedClassTypeId] = useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [weeksToGenerate, setWeeksToGenerate] = useState(4);
  
  // Add class type form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("aerobics");
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [maxCapacity, setMaxCapacity] = useState(20);
  const [isHeated, setIsHeated] = useState(false);
  
  // Quick schedule form state
  const [instructorId, setInstructorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [room, setRoom] = useState("");

  // Fetch class types with schedule counts
  const { data: classTypesData, isLoading } = useQuery({
    queryKey: ['class-types-grouped'],
    queryFn: async () => {
      const [typesRes, schedulesRes] = await Promise.all([
        supabase.from("class_types").select("*").order("name"),
        supabase.from("class_schedules").select("id, class_type_id, is_active"),
      ]);
      
      if (typesRes.error) throw typesRes.error;
      if (schedulesRes.error) throw schedulesRes.error;
      
      const types = typesRes.data as ClassType[];
      const schedules = schedulesRes.data as ClassSchedule[];
      
      // Count schedules per class type
      const scheduleCounts: Record<string, number> = {};
      schedules.forEach(s => {
        if (s.is_active) {
          scheduleCounts[s.class_type_id] = (scheduleCounts[s.class_type_id] || 0) + 1;
        }
      });
      
      // Group by category
      const grouped: Record<string, Array<ClassType & { scheduleCount: number }>> = {};
      types.forEach(type => {
        const cat = type.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ ...type, scheduleCount: scheduleCounts[type.id] || 0 });
      });
      
      // Sort categories by order
      const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const orderA = CATEGORY_CONFIG[a]?.order || 99;
        const orderB = CATEGORY_CONFIG[b]?.order || 99;
        return orderA - orderB;
      });
      
      return { grouped, sortedCategories, totalActiveSchedules: schedules.filter(s => s.is_active).length };
    },
  });

  // Fetch instructors for quick schedule
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
        .eq("is_cancelled", false);
      if (error) throw error;
      return count || 0;
    },
  });

  // Create class type mutation
  const createTypeMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      
      const { error } = await supabase.from("class_types").insert([{
        name: name.trim(),
        description: description.trim() || null,
        category: category as any,
        duration_minutes: durationMinutes,
        max_capacity: maxCapacity,
        is_heated: isHeated,
        is_active: true,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-types-grouped'] });
      toast.success("Class type created");
      setAddTypeDialogOpen(false);
      resetTypeForm();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to create class type");
    },
  });

  // Quick add schedule mutation
  const quickScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClassTypeId) throw new Error("No class type selected");
      
      const { error } = await supabase.from("class_schedules").insert([{
        class_type_id: selectedClassTypeId,
        instructor_id: instructorId || null,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room: room.trim() || null,
        is_active: true,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-types-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['class-schedules-for-type', selectedClassTypeId] });
      toast.success("Schedule added");
      setQuickScheduleDialogOpen(false);
      resetScheduleForm();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to add schedule");
    },
  });

  // Generate sessions mutation
  const generateSessionsMutation = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase.rpc('generate_class_sessions', {
        _start_date: today,
        _weeks_ahead: weeksToGenerate
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions-count'] });
      const result = data?.[0];
      if (result) {
        toast.success(`Generated ${result.sessions_created} new sessions (${result.sessions_skipped} already existed)`);
      } else {
        toast.success("Session generation complete");
      }
      setGenerateDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to generate sessions");
    },
  });

  function resetTypeForm() {
    setName("");
    setDescription("");
    setCategory("aerobics");
    setDurationMinutes(50);
    setMaxCapacity(20);
    setIsHeated(false);
  }

  function resetScheduleForm() {
    setSelectedClassTypeId(null);
    setInstructorId("");
    setDayOfWeek(1);
    setStartTime("09:00");
    setEndTime("09:50");
    setRoom("");
  }

  function openQuickSchedule(classTypeId: string) {
    navigate(`/admin/class-schedules?classTypeId=${classTypeId}`);
  }

  const { grouped = {}, sortedCategories = [] } = classTypesData || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class Management</h1>
            <p className="text-muted-foreground">
              Manage class types. Use Class Schedules for ongoing, date-range, and one-off classes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setGenerateDialogOpen(true)}
              disabled={classTypesData?.totalActiveSchedules === 0}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Generate Sessions
            </Button>
            <Button onClick={() => setAddTypeDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Class Type
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Class Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(grouped).reduce((acc, arr) => acc + arr.length, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classTypesData?.totalActiveSchedules || 0}</div>
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
              <p className="text-xs text-muted-foreground">Bookable classes</p>
            </CardContent>
          </Card>
        </div>

        {/* Class Types by Category */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedCategories.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No class types yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first class type to get started
              </p>
              <Button className="mt-4" onClick={() => setAddTypeDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Class Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={sortedCategories} className="space-y-4">
            {sortedCategories.map((categoryKey) => {
              const categoryTypes = grouped[categoryKey] || [];
              const categoryLabel = CATEGORY_CONFIG[categoryKey]?.label || categoryKey;
              const totalSchedules = categoryTypes.reduce((acc, t) => acc + t.scheduleCount, 0);
              
              return (
                <AccordionItem 
                  key={categoryKey} 
                  value={categoryKey}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{categoryLabel}</span>
                        <Badge variant="secondary">{categoryTypes.length} classes</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {totalSchedules} schedule{totalSchedules !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {categoryTypes.map((classType) => (
                        <ClassTypeCard
                          key={classType.id}
                          id={classType.id}
                          name={classType.name}
                          category={classType.category}
                          durationMinutes={classType.duration_minutes}
                          maxCapacity={classType.max_capacity}
                          isHeated={classType.is_heated}
                          isActive={classType.is_active}
                          scheduleCount={classType.scheduleCount}
                          onAddSchedule={() => openQuickSchedule(classType.id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* Add Class Type Dialog */}
      <Dialog open={addTypeDialogOpen} onOpenChange={setAddTypeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Class Type</DialogTitle>
            <DialogDescription>Create a new type of class</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Reformer Sculpt"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the class"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createTypeMutation.mutate()} disabled={createTypeMutation.isPending}>
              {createTypeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Schedule Dialog */}
      <Dialog open={quickScheduleDialogOpen} onOpenChange={(open) => {
        setQuickScheduleDialogOpen(open);
        if (!open) resetScheduleForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Schedule</DialogTitle>
            <DialogDescription>
              Adds an ongoing weekly schedule for this class. For date-range or one-off classes, use Class Schedules.
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
            <div className="grid gap-2">
              <Label>Room</Label>
              <Input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g., Studio A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => quickScheduleMutation.mutate()} disabled={quickScheduleMutation.isPending}>
              {quickScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Sessions Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Class Sessions</DialogTitle>
            <DialogDescription>
              Create bookable sessions from your recurring schedules
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Weeks to generate</Label>
            <Select value={weeksToGenerate.toString()} onValueChange={(v) => setWeeksToGenerate(parseInt(v))}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 weeks</SelectItem>
                <SelectItem value="4">4 weeks</SelectItem>
                <SelectItem value="8">8 weeks</SelectItem>
                <SelectItem value="12">12 weeks</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              Sessions will be generated until {format(addWeeks(new Date(), weeksToGenerate), 'MMMM d, yyyy')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => generateSessionsMutation.mutate()} disabled={generateSessionsMutation.isPending}>
              {generateSessionsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
