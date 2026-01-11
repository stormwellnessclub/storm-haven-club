import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, Clock, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramWorkout, Exercise } from "@/hooks/useWorkoutPrograms";

interface ProgramWorkoutCardProps {
  workout: ProgramWorkout;
  onComplete: () => void;
  isCompleting?: boolean;
}

export function ProgramWorkoutCard({ workout, onComplete, isCompleting }: ProgramWorkoutCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className={cn(
      "transition-all",
      workout.is_completed && "opacity-75 bg-muted/50"
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  workout.is_completed 
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-accent/10 text-accent"
                )}>
                  {workout.is_completed ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Dumbbell className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base font-medium">
                    Day {workout.day_number}: {workout.workout_name}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    {workout.focus_area && (
                      <Badge variant="outline" className="text-xs">
                        {workout.focus_area}
                      </Badge>
                    )}
                    {workout.duration_minutes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {workout.duration_minutes} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Exercises List */}
            <div className="space-y-3">
              {(workout.exercises as Exercise[]).map((exercise, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{exercise.name}</p>
                    {exercise.equipment && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exercise.equipment}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-foreground">
                      {exercise.sets} × {exercise.reps}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rest: {exercise.rest}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {workout.notes && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span> {workout.notes}
                </p>
              </div>
            )}

            {/* Complete Button */}
            {!workout.is_completed && (
              <Button 
                onClick={onComplete} 
                disabled={isCompleting}
                className="w-full"
              >
                {isCompleting ? "Marking Complete..." : "Mark as Complete"}
              </Button>
            )}

            {workout.is_completed && workout.completed_at && (
              <p className="text-sm text-center text-green-600 dark:text-green-400">
                ✓ Completed on {new Date(workout.completed_at).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
