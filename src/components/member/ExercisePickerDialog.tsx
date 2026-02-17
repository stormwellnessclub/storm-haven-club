import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus } from "lucide-react";
import {
  exerciseLibrary,
  BODY_PARTS,
  EQUIPMENT_CATEGORIES,
  searchExercises,
  type ExerciseDefinition,
  type BodyPart,
  type EquipmentCategory,
} from "@/lib/exerciseLibrary";
import type { WorkoutExercise } from "@/hooks/useWorkoutTemplates";

interface ExercisePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (exercise: WorkoutExercise) => void;
}

export function ExercisePickerDialog({ open, onOpenChange, onAdd }: ExercisePickerDialogProps) {
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<BodyPart | undefined>();
  const [equipmentCategory, setEquipmentCategory] = useState<EquipmentCategory | undefined>();

  const results = useMemo(
    () => searchExercises(query, bodyPart, equipmentCategory),
    [query, bodyPart, equipmentCategory]
  );

  const handleAdd = (ex: ExerciseDefinition) => {
    onAdd({
      exerciseId: ex.id,
      name: ex.name,
      bodyPart: ex.bodyPart,
      equipment: ex.equipment,
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      rest: ex.defaultRest,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogDescription>Browse the exercise library and add to your workout</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Body Part Filters */}
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={!bodyPart ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setBodyPart(undefined)}
            >
              All
            </Badge>
            {BODY_PARTS.map((bp) => (
              <Badge
                key={bp}
                variant={bodyPart === bp ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setBodyPart(bodyPart === bp ? undefined : bp)}
              >
                {bp}
              </Badge>
            ))}
          </div>

          {/* Equipment Filters */}
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={!equipmentCategory ? "secondary" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setEquipmentCategory(undefined)}
            >
              All Equipment
            </Badge>
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={equipmentCategory === cat ? "secondary" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setEquipmentCategory(equipmentCategory === cat ? undefined : cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          {/* Results */}
          <ScrollArea className="h-[350px]">
            <div className="space-y-1">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No exercises found</p>
              ) : (
                results.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{ex.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ex.targetMuscle} · {ex.equipment} · {ex.defaultSets}×{ex.defaultReps}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                      onClick={() => handleAdd(ex)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
