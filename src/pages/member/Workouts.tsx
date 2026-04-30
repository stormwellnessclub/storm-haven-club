import { useState } from "react";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkoutLogs, useCreateWorkoutLog, useUpdateWorkoutLog, useDeleteWorkoutLog, WorkoutLog, CreateWorkoutLogData } from "@/hooks/useWorkoutLogs";
import { useAIWorkouts, useGenerateAIWorkout, useCompleteAIWorkout, useDeleteAIWorkout, AIWorkout, WorkoutPreferences } from "@/hooks/useAIWorkouts";
import { useWorkoutPrograms, useGenerateProgram, WorkoutProgram } from "@/hooks/useWorkoutPrograms";
import { useFitnessProfile } from "@/hooks/useFitnessProfile";
import { useWorkoutTemplates, useDeleteTemplate, useLogFromTemplate, type WorkoutTemplate } from "@/hooks/useWorkoutTemplates";
import { GenerateWorkoutModal } from "@/components/member/GenerateWorkoutModal";
import { GenerateProgramModal, ProgramPreferences } from "@/components/member/GenerateProgramModal";
import { ExerciseCard } from "@/components/member/ExerciseCard";
import { ProgramDashboard } from "@/components/member/ProgramDashboard";
import { WorkoutBuilder } from "@/components/member/WorkoutBuilder";
import { useEquipmentImages, findEquipmentImage } from "@/hooks/useEquipmentImages";
import {
  Dumbbell,
  Plus,
  Clock,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  Settings,
  Info,
  Calendar,
  Wrench,
  Star,
  Play,
  LayoutTemplate,
  History,
  RotateCcw,
  MoreHorizontal,
  Flame,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearPersisted } from "@/hooks/usePersistedState";

const WORKOUT_TYPES = [
  "Strength Training",
  "Cardio",
  "Yoga",
  "Pilates",
  "HIIT",
  "CrossFit",
  "Swimming",
  "Cycling",
  "Running",
  "Other",
];

export default function Workouts() {
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const [formData, setFormData] = useState<CreateWorkoutLogData>({
    workout_type: "",
    workout_name: "",
    duration_minutes: undefined,
    calories_burned: undefined,
    notes: "",
    exercises: [],
    performed_at: new Date().toISOString(),
  });

  const { data: workouts, isLoading } = useWorkoutLogs();
  const { data: aiWorkouts, isLoading: aiLoading } = useAIWorkouts(undefined, 5);
  const { data: programs, isLoading: programsLoading } = useWorkoutPrograms();
  const { data: fitnessProfile } = useFitnessProfile();
  const { data: templates, isLoading: templatesLoading } = useWorkoutTemplates();
  const { data: equipmentImages } = useEquipmentImages();
  const deleteTemplate = useDeleteTemplate();
  const logFromTemplate = useLogFromTemplate();
  const createWorkout = useCreateWorkoutLog();
  const updateWorkout = useUpdateWorkoutLog();
  const deleteWorkout = useDeleteWorkoutLog();
  const generateAIWorkout = useGenerateAIWorkout();
  const completeAIWorkout = useCompleteAIWorkout();
  const deleteAIWorkout = useDeleteAIWorkout();
  const generateProgram = useGenerateProgram();

  // Get active program
  const activeProgram = programs?.find(p => p.is_active);
  const pastPrograms = programs?.filter(p => !p.is_active) || [];

  const [reactivating, setReactivating] = useState<string | null>(null);

  const handleReactivateProgram = async (program: WorkoutProgram) => {
    setReactivating(program.id);
    try {
      if (activeProgram) {
        await supabase
          .from("workout_programs")
          .update({ is_active: false })
          .eq("id", activeProgram.id);
      }
      await supabase
        .from("workout_programs")
        .update({ is_active: true })
        .eq("id", program.id);
      window.location.reload();
    } catch {
      toast.error("Failed to reactivate program");
      setReactivating(null);
    }
  };

  // Calculate statistics
  const stats = {
    totalWorkouts: workouts?.length || 0,
    thisWeek: workouts?.filter(w => {
      const date = new Date(w.performed_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }).length || 0,
    thisMonth: workouts?.filter(w => {
      const date = new Date(w.performed_at);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return date >= monthAgo;
    }).length || 0,
    totalMinutes: workouts?.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) || 0,
  };

  const workoutTypesCount = workouts?.reduce((acc, w) => {
    acc[w.workout_type] = (acc[w.workout_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const favoriteType = Object.entries(workoutTypesCount).sort((a, b) => b[1] - a[1])[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWorkout) {
        await updateWorkout.mutateAsync({ id: editingWorkout.id, data: formData });
      } else {
        await createWorkout.mutateAsync(formData);
      }
      setShowLogDialog(false);
      setEditingWorkout(null);
      resetForm();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const resetForm = () => {
    setFormData({
      workout_type: "",
      workout_name: "",
      duration_minutes: undefined,
      calories_burned: undefined,
      notes: "",
      exercises: [],
      performed_at: new Date().toISOString(),
    });
  };

  const handleEdit = (workout: WorkoutLog) => {
    setEditingWorkout(workout);
    setFormData({
      workout_type: workout.workout_type,
      workout_name: workout.workout_name || "",
      duration_minutes: workout.duration_minutes || undefined,
      calories_burned: workout.calories_burned || undefined,
      notes: workout.notes || "",
      exercises: workout.exercises || [],
      performed_at: workout.performed_at,
    });
    setShowLogDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this workout?")) {
      await deleteWorkout.mutateAsync(id);
    }
  };

  const handleGenerateAIWorkout = async (preferences: WorkoutPreferences) => {
    try {
      await generateAIWorkout.mutateAsync(preferences);
      // Clear persisted modal state so the next visit starts fresh.
      clearPersisted("workouts.generate.step.v1");
      clearPersisted("workouts.generate.prefs.v1");
      setShowGenerateModal(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleGenerateProgram = async (preferences: ProgramPreferences) => {
    try {
      await generateProgram.mutateAsync(preferences);
      clearPersisted("workouts.generateProgram.step.v1");
      clearPersisted("workouts.generateProgram.prefs.v1");
      setShowProgramModal(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCompleteAIWorkout = async (id: string) => {
    await completeAIWorkout.mutateAsync(id);
    // Optionally create a workout log from the AI workout
    const aiWorkout = aiWorkouts?.find(w => w.id === id);
    if (aiWorkout) {
      await createWorkout.mutateAsync({
        workout_type: aiWorkout.workout_type,
        workout_name: aiWorkout.workout_name,
        duration_minutes: aiWorkout.duration_minutes || undefined,
        exercises: aiWorkout.exercises,
        performed_at: new Date().toISOString(),
      });
    }
  };

  return (
    <MemberLayout title="Workouts">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="heading-section">Workout Log</h2>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Track your workouts and build your fitness journey
            </p>
          </div>

          {/* Action buttons — wrap on small screens, dropdown for secondary on mobile */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => { setEditingWorkout(null); resetForm(); }}
                  className="flex-1 sm:flex-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Log Workout
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingWorkout ? "Edit Workout" : "Log New Workout"}</DialogTitle>
                  <DialogDescription>
                    Record your workout details and exercises
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="workout_type">Workout Type *</Label>
                      <Select
                        value={formData.workout_type}
                        onValueChange={(value) => setFormData({ ...formData, workout_type: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKOUT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workout_name">Workout Name</Label>
                      <Input
                        id="workout_name"
                        value={formData.workout_name || ""}
                        onChange={(e) => setFormData({ ...formData, workout_name: e.target.value })}
                        placeholder="e.g., Morning Strength Session"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={formData.duration_minutes || ""}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="calories">Calories Burned</Label>
                      <Input
                        id="calories"
                        type="number"
                        value={formData.calories_burned || ""}
                        onChange={(e) => setFormData({ ...formData, calories_burned: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="300"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="performed_at">Date & Time</Label>
                    <Input
                      id="performed_at"
                      type="datetime-local"
                      value={formData.performed_at ? format(new Date(formData.performed_at), "yyyy-MM-dd'T'HH:mm") : ""}
                      onChange={(e) => setFormData({ ...formData, performed_at: new Date(e.target.value).toISOString() })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ""}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="How did you feel? Any observations..."
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowLogDialog(false);
                        setEditingWorkout(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createWorkout.isPending || updateWorkout.isPending}>
                      {createWorkout.isPending || updateWorkout.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : editingWorkout ? (
                        "Update Workout"
                      ) : (
                        "Log Workout"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Mobile: secondary actions in a dropdown */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More workout options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => { setEditingTemplate(null); setShowBuilder(true); }}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Build Custom Workout
                  </DropdownMenuItem>
                  {fitnessProfile ? (
                    <DropdownMenuItem onClick={() => setShowGenerateModal(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Workout
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild>
                      <Link to="/member/fitness-profile">
                        <Settings className="h-4 w-4 mr-2" />
                        Create Fitness Profile
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop: full button row */}
            <Button
              variant="gold"
              onClick={() => { setEditingTemplate(null); setShowBuilder(true); }}
              className="hidden sm:inline-flex"
            >
              <Wrench className="h-4 w-4 mr-2" />
              Build Custom Workout
            </Button>

            {fitnessProfile ? (
              <Button
                variant="outline"
                onClick={() => setShowGenerateModal(true)}
                className="hidden sm:inline-flex"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Workout
              </Button>
            ) : (
              <Button variant="outline" asChild className="hidden sm:inline-flex">
                <Link to="/member/fitness-profile">
                  <Settings className="h-4 w-4 mr-2" />
                  Create Fitness Profile
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Generate Workout Modal */}
        <GenerateWorkoutModal
          open={showGenerateModal}
          onOpenChange={setShowGenerateModal}
          onGenerate={handleGenerateAIWorkout}
          isGenerating={generateAIWorkout.isPending}
        />

        {/* Generate Program Modal */}
        <GenerateProgramModal
          open={showProgramModal}
          onOpenChange={setShowProgramModal}
          onGenerate={handleGenerateProgram}
          isGenerating={generateProgram.isPending}
        />

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Workouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeek}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Minutes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMinutes}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {favoriteType && `${favoriteType[0]} is your favorite`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={activeProgram ? "programs" : "logged"} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
            <TabsList className="w-max sm:w-auto">
              <TabsTrigger value="programs" className="gap-1.5 whitespace-nowrap">
                <Calendar className="h-4 w-4" />
                Programs {activeProgram && <Badge variant="secondary" className="ml-1 text-xs">Active</Badge>}
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5 whitespace-nowrap">
                <LayoutTemplate className="h-4 w-4" />
                Templates ({templates?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="logged" className="whitespace-nowrap">Logged ({workouts?.length || 0})</TabsTrigger>
              <TabsTrigger value="ai" className="whitespace-nowrap">AI Workouts ({aiWorkouts?.length || 0})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="programs">
            {programsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : activeProgram ? (
              <ProgramDashboard 
                program={activeProgram} 
                onRegenerateProgram={() => setShowProgramModal(true)}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium mb-2">No Active Program</p>
                  <p className="text-muted-foreground mb-4">
                    Create a structured 4-week workout program tailored to your goals
                  </p>
                  {fitnessProfile ? (
                    <Button onClick={() => setShowProgramModal(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate 4-Week Program
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Fitness Profile Required</AlertTitle>
                        <AlertDescription>
                          Create your fitness profile to unlock personalized program generation.
                        </AlertDescription>
                      </Alert>
                      <Button variant="outline" asChild>
                        <Link to="/member/fitness-profile">
                          <Settings className="h-4 w-4 mr-2" />
                          Create Fitness Profile
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


            {/* Past Programs */}
            {pastPrograms.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                  <History className="h-4 w-4" />
                  Past Programs ({pastPrograms.length})
                </h3>
                <div className="space-y-2">
                  {pastPrograms.map((program) => (
                    <Card key={program.id} className="p-4 opacity-80">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{program.program_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {program.program_type} · {program.duration_weeks} weeks · {program.days_per_week} days/week
                            {program.completed_at && ` · Completed ${format(new Date(program.completed_at), "MMM d, yyyy")}`}
                            {!program.completed_at && program.created_at && ` · Created ${format(new Date(program.created_at), "MMM d, yyyy")}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reactivating === program.id}
                          onClick={() => handleReactivateProgram(program)}
                        >
                          {reactivating === program.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          )}
                          Reactivate
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates">
            {templatesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="space-y-3">
                {templates.map((template) => (
                  <Card key={template.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{template.template_name}</h3>
                          {template.is_favorite && <Star className="h-3.5 w-3.5 text-accent fill-accent" />}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {template.workout_type && (
                            <Badge variant="secondary" className="text-xs">{template.workout_type}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {template.exercises.length} exercise{template.exercises.length !== 1 ? "s" : ""}
                          </span>
                          {template.estimated_duration_minutes && (
                            <span className="text-xs text-muted-foreground">· ~{template.estimated_duration_minutes} min</span>
                          )}
                          <span className="text-xs text-muted-foreground">· Used {template.times_used}×</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={() => logFromTemplate.mutate(template)}
                          disabled={logFromTemplate.isPending}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Log
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditingTemplate(template); setShowBuilder(true); }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm("Delete this template?")) deleteTemplate.mutate(template.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <LayoutTemplate className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No workout templates yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => { setEditingTemplate(null); setShowBuilder(true); }}
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Build Your First Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logged">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : workouts && workouts.length > 0 ? (
              <>
                {/* Desktop: dense table */}
                <Card className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Calories</TableHead>
                        <TableHead>Exercises</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workouts.map((workout) => (
                        <TableRow key={workout.id}>
                          <TableCell>
                            {format(new Date(workout.performed_at), "MMM d, yyyy")}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(workout.performed_at), "h:mm a")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{workout.workout_type}</div>
                              {workout.workout_name && (
                                <div className="text-xs text-muted-foreground">{workout.workout_name}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {workout.duration_minutes ? `${workout.duration_minutes} min` : "—"}
                          </TableCell>
                          <TableCell>
                            {workout.calories_burned ? `${workout.calories_burned} cal` : "—"}
                          </TableCell>
                          <TableCell>
                            {workout.exercises && workout.exercises.length > 0 ? (
                              <div className="text-sm">
                                {workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(workout)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(workout.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Mobile: stacked cards — no horizontal scroll */}
                <div className="md:hidden space-y-2">
                  {workouts.map((workout) => (
                    <Card key={workout.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{workout.workout_type}</span>
                            {workout.workout_name && (
                              <span className="text-xs text-muted-foreground truncate">
                                · {workout.workout_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(workout.performed_at), "MMM d, yyyy")} · {format(new Date(workout.performed_at), "h:mm a")}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                            {workout.duration_minutes != null && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {workout.duration_minutes} min
                              </span>
                            )}
                            {workout.calories_burned != null && (
                              <span className="flex items-center gap-1">
                                <Flame className="h-3 w-3" />
                                {workout.calories_burned} cal
                              </span>
                            )}
                            {workout.exercises && workout.exercises.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Dumbbell className="h-3 w-3" />
                                {workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(workout)}
                            aria-label="Edit workout"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(workout.id)}
                            aria-label="Delete workout"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No workouts logged yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowLogDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Log Your First Workout
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ai">
            {aiLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : aiWorkouts && aiWorkouts.length > 0 ? (
              <div className="space-y-4">
                {aiWorkouts.map((workout) => (
                  <Card key={workout.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-accent" />
                            {workout.workout_name || workout.workout_type}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {workout.workout_type}
                            {workout.difficulty && ` • ${workout.difficulty}`}
                            {workout.duration_minutes && ` • ${workout.duration_minutes} min`}
                          </CardDescription>
                        </div>
                        {workout.is_completed && (
                          <Badge className="bg-success/20 text-success border-success/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {workout.exercises && workout.exercises.length > 0 && (
                        <div className="space-y-3 mb-4">
                          <p className="text-sm font-medium">Exercises:</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            {workout.exercises.map((exercise, idx) => (
                              <ExerciseCard
                                key={idx}
                                exercise={exercise}
                                index={idx}
                                imageUrl={findEquipmentImage(exercise.equipment, equipmentImages)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {workout.ai_reasoning && (
                        <div className="mb-4 p-3 bg-muted/50 rounded text-sm">
                          <p className="font-medium mb-1">AI Reasoning:</p>
                          <p className="text-muted-foreground">{workout.ai_reasoning}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {!workout.is_completed && (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteAIWorkout(workout.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteAIWorkout.mutate(workout.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No AI workouts generated yet</p>
                  {fitnessProfile ? (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowGenerateModal(true)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Workout
                    </Button>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Fitness Profile Required</AlertTitle>
                        <AlertDescription>
                          Create your fitness profile to unlock personalized AI workout generation.
                        </AlertDescription>
                      </Alert>
                      <Button variant="outline" asChild>
                        <Link to="/member/fitness-profile">
                          <Settings className="h-4 w-4 mr-2" />
                          Create Fitness Profile
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Workout Builder */}
        <WorkoutBuilder
          open={showBuilder}
          onOpenChange={setShowBuilder}
          editingTemplate={editingTemplate}
        />
      </div>
    </MemberLayout>
  );
}
