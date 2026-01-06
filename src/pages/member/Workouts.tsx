import { useState } from "react";
import * as React from "react";
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
import { useAIWorkouts, useGenerateAIWorkout, useCompleteAIWorkout, useDeleteAIWorkout, AIWorkout } from "@/hooks/useAIWorkouts";
import { useFitnessProfile } from "@/hooks/useFitnessProfile";
import { useExercises, ExerciseDBExercise } from "@/hooks/useExerciseDB";
import { exerciseDBClient } from "@/lib/exercisedb";
import {
  Dumbbell,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  Loader2,
  Zap,
  Settings,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const { data: fitnessProfile } = useFitnessProfile();
  const createWorkout = useCreateWorkoutLog();
  const updateWorkout = useUpdateWorkoutLog();
  const deleteWorkout = useDeleteWorkoutLog();
  const generateAIWorkout = useGenerateAIWorkout();
  const completeAIWorkout = useCompleteAIWorkout();
  const deleteAIWorkout = useDeleteAIWorkout();

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

  const handleGenerateAIWorkout = async () => {
    try {
      await generateAIWorkout.mutateAsync();
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-section">Workout Log</h2>
            <p className="text-muted-foreground mt-1">
              Track your workouts and build your fitness journey
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingWorkout(null); resetForm(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Workout
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingWorkout ? "Edit Workout" : "Log New Workout"}</DialogTitle>
                  <DialogDescription>
                    Record your workout details and exercises
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex gap-2 justify-end">
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

            {fitnessProfile ? (
              <Button variant="outline" onClick={handleGenerateAIWorkout} disabled={generateAIWorkout.isPending}>
                {generateAIWorkout.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Workout
                  </>
                )}
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/member/fitness-profile">
                  <Settings className="h-4 w-4 mr-2" />
                  Create Fitness Profile
                </Link>
              </Button>
            )}
          </div>
        </div>

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

        <Tabs defaultValue="logged" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logged">Logged Workouts ({workouts?.length || 0})</TabsTrigger>
            <TabsTrigger value="ai">AI Generated ({aiWorkouts?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="logged">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : workouts && workouts.length > 0 ? (
              <Card>
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
                              <ExerciseCard key={idx} exercise={exercise} />
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
                      onClick={handleGenerateAIWorkout}
                      disabled={generateAIWorkout.isPending}
                    >
                      {generateAIWorkout.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Workout
                        </>
                      )}
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
      </div>
    </MemberLayout>
  );
}

// Exercise Card Component with ExerciseDB integration
function ExerciseCard({ exercise }: { exercise: AIWorkout['exercises'][0] }) {
  const [exerciseDBData, setExerciseDBData] = React.useState<ExerciseDBExercise | null>(null);
  const [loadingExercise, setLoadingExercise] = React.useState(false);

  React.useEffect(() => {
    // Try to find matching exercise in ExerciseDB by name
    // Use search instead of fetching all exercises for better performance
    if (exercise.name && exerciseDBClient.isConfigured()) {
      setLoadingExercise(true);
      // Search for exercises with similar name
      exerciseDBClient.searchExercises({}, 100).then((exercises) => {
        const match = exercises.find(
          (ex) => ex.name.toLowerCase() === exercise.name.toLowerCase() ||
                  ex.name.toLowerCase().includes(exercise.name.toLowerCase()) ||
                  exercise.name.toLowerCase().includes(ex.name.toLowerCase())
        );
        setExerciseDBData(match || null);
        setLoadingExercise(false);
      }).catch(() => {
        // If search fails, try a targeted search by body part or equipment
        setLoadingExercise(false);
      });
    }
  }, [exercise.name]);

  return (
    <div className="p-3 bg-secondary/50 rounded-lg border hover:bg-secondary/70 transition-colors">
      <div className="flex gap-3">
        {exerciseDBData?.gifUrl && (
          <div className="flex-shrink-0">
            <img
              src={exerciseDBData.gifUrl}
              alt={exercise.name}
              className="w-20 h-20 object-cover rounded border"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{exercise.name}</div>
          {exerciseDBData && (
            <div className="text-xs text-muted-foreground mt-1">
              {exerciseDBData.target && (
                <Badge variant="outline" className="mr-1 text-[10px]">
                  {exerciseDBData.target}
                </Badge>
              )}
              {exerciseDBData.bodyPart && (
                <Badge variant="outline" className="mr-1 text-[10px]">
                  {exerciseDBData.bodyPart}
                </Badge>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            {exercise.sets && <div>Sets: {exercise.sets}</div>}
            {exercise.reps && <div>Reps: {exercise.reps}</div>}
            {exercise.weight && <div>Weight: {exercise.weight}</div>}
            {exercise.duration_seconds && <div>Duration: {exercise.duration_seconds}s</div>}
            {exercise.rest_seconds && <div>Rest: {exercise.rest_seconds}s</div>}
          </div>
          {exercise.notes && (
            <div className="text-xs text-muted-foreground mt-2 italic">
              {exercise.notes}
            </div>
          )}
          {exerciseDBData?.instructions && exerciseDBData.instructions.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-accent cursor-pointer hover:underline">
                View Instructions
              </summary>
              <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                {exerciseDBData.instructions.slice(0, 3).map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

