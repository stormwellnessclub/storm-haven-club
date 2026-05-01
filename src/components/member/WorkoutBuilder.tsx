import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Dumbbell, Play, GripVertical } from "lucide-react";
import { ExercisePickerDialog } from "./ExercisePickerDialog";
import {
  useCreateTemplate,
  useUpdateTemplate,
  type WorkoutExercise,
  type WorkoutTemplate,
  type CreateTemplateData,
} from "@/hooks/useWorkoutTemplates";
import { useCreateWorkoutLog } from "@/hooks/useWorkoutLogs";

const WORKOUT_TYPES = [
  "Strength Training",
  "Cardio",
  "HIIT",
  "Full Body",
  "Upper Body",
  "Lower Body",
  "Push",
  "Pull",
  "Core",
];

interface WorkoutBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplate?: WorkoutTemplate | null;
}

export function WorkoutBuilder({ open, onOpenChange, editingTemplate }: WorkoutBuilderProps) {
  const [name, setName] = useState(editingTemplate?.template_name || "");
  const [workoutType, setWorkoutType] = useState(editingTemplate?.workout_type || "");
  const [exercises, setExercises] = useState<WorkoutExercise[]>(editingTemplate?.exercises || []);
  const [showPicker, setShowPicker] = useState(false);

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const createWorkoutLog = useCreateWorkoutLog();

  // Reset state when dialog opens with new template or empty
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(editingTemplate?.template_name || "");
      setWorkoutType(editingTemplate?.workout_type || "");
      setExercises(editingTemplate?.exercises || []);
    }
    onOpenChange(isOpen);
  };

  const addExercise = (exercise: WorkoutExercise) => {
    setExercises((prev) => [...prev, exercise]);
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  };

  const estimatedDuration = exercises.reduce((total, ex) => {
    const setTime = ex.sets * (30 + ex.rest); // ~30s per set + rest
    return total + setTime;
  }, 0);
  const estimatedMinutes = Math.round(estimatedDuration / 60);

  const handleSaveTemplate = async () => {
    if (!name.trim() || exercises.length === 0) return;
    const data: CreateTemplateData = {
      template_name: name.trim(),
      workout_type: workoutType || undefined,
      exercises,
      estimated_duration_minutes: estimatedMinutes || undefined,
    };
    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, data });
    } else {
      await createTemplate.mutateAsync(data);
    }
    onOpenChange(false);
  };

  const handleLogWorkout = async () => {
    if (exercises.length === 0) return;
    await createWorkoutLog.mutateAsync({
      workout_type: workoutType || name.trim() || "Custom Workout",
      workout_name: name.trim() || undefined,
      duration_minutes: estimatedMinutes || undefined,
      exercises,
      performed_at: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;
  const isLogging = createWorkoutLog.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Workout Template" : "Build Custom Workout"}</DialogTitle>
            <DialogDescription>
              Add exercises, set your reps & weight, then save as a template or log it
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="builder-name">Workout Name</Label>
                <Input
                  id="builder-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Push Day A"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Workout Type</Label>
                <Select value={workoutType} onValueChange={setWorkoutType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{exercises.length} exercise{exercises.length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>~{estimatedMinutes} min estimated</span>
            </div>

            {/* Exercise list */}
            <div className="space-y-2">
              {exercises.length === 0 ? (
                <Card className="py-8 text-center">
                  <Dumbbell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No exercises added yet</p>
                </Card>
              ) : (
                exercises.map((ex, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ex.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {ex.bodyPart} · {ex.equipment}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeExercise(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">Sets</Label>
                            <Input
                              type="number"
                              min={1}
                              value={ex.sets}
                              onChange={(e) => updateExercise(idx, "sets", parseInt(e.target.value) || 1)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Reps</Label>
                            <Input
                              type="number"
                              min={1}
                              value={ex.reps}
                              onChange={(e) => updateExercise(idx, "reps", parseInt(e.target.value) || 1)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Weight</Label>
                            <Input
                              type="number"
                              min={0}
                              value={ex.weight || ""}
                              onChange={(e) => updateExercise(idx, "weight", e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="lbs"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Rest (s)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={ex.rest}
                              onChange={(e) => updateExercise(idx, "rest", parseInt(e.target.value) || 0)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Add exercise button */}
            <Button variant="outline" className="w-full" onClick={() => setShowPicker(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Exercise
            </Button>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={handleSaveTemplate}
                disabled={!name.trim() || exercises.length === 0 || isSaving}
                loading={isSaving}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingTemplate ? "Update Template" : "Save as Template"}
              </Button>
              <Button
                variant="gold"
                onClick={handleLogWorkout}
                disabled={exercises.length === 0 || isLogging}
                loading={isLogging}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Log Workout Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ExercisePickerDialog
        open={showPicker}
        onOpenChange={setShowPicker}
        onAdd={addExercise}
      />
    </>
  );
}
