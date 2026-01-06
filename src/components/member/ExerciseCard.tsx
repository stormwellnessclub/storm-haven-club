import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  Dumbbell,
  Timer,
  Repeat,
  Weight,
  Info,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  weight?: string;
  duration?: string;
  rest?: string;
  notes?: string;
  equipment?: string;
  targetMuscle?: string;
  bodyPart?: string;
  instructions?: string[];
}

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
}

// Map body parts to icons and colors
const getBodyPartStyle = (bodyPart?: string) => {
  const styles: Record<string, { color: string; bgColor: string }> = {
    chest: { color: "text-red-600", bgColor: "bg-red-100" },
    back: { color: "text-blue-600", bgColor: "bg-blue-100" },
    shoulders: { color: "text-purple-600", bgColor: "bg-purple-100" },
    arms: { color: "text-orange-600", bgColor: "bg-orange-100" },
    biceps: { color: "text-orange-600", bgColor: "bg-orange-100" },
    triceps: { color: "text-orange-500", bgColor: "bg-orange-100" },
    legs: { color: "text-green-600", bgColor: "bg-green-100" },
    glutes: { color: "text-pink-600", bgColor: "bg-pink-100" },
    core: { color: "text-yellow-600", bgColor: "bg-yellow-100" },
    cardio: { color: "text-cyan-600", bgColor: "bg-cyan-100" },
  };
  
  const lowerBodyPart = bodyPart?.toLowerCase() || "";
  return styles[lowerBodyPart] || { color: "text-muted-foreground", bgColor: "bg-muted" };
};

export function ExerciseCard({ exercise, index }: ExerciseCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const bodyPartStyle = getBodyPartStyle(exercise.bodyPart);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Exercise number indicator */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">{index + 1}</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Exercise header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-foreground">{exercise.name}</h4>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {exercise.targetMuscle && (
                    <Badge variant="secondary" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {exercise.targetMuscle}
                    </Badge>
                  )}
                  {exercise.bodyPart && (
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", bodyPartStyle.color, bodyPartStyle.bgColor)}
                    >
                      {exercise.bodyPart}
                    </Badge>
                  )}
                  {exercise.equipment && (
                    <Badge variant="outline" className="text-xs">
                      <Dumbbell className="h-3 w-3 mr-1" />
                      {exercise.equipment}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Exercise details */}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              {exercise.sets && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Repeat className="h-4 w-4" />
                  <span>{exercise.sets} sets</span>
                </div>
              )}
              {exercise.reps && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium">{exercise.reps} reps</span>
                </div>
              )}
              {exercise.weight && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Weight className="h-4 w-4" />
                  <span>{exercise.weight}</span>
                </div>
              )}
              {exercise.duration && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>{exercise.duration}</span>
                </div>
              )}
              {exercise.rest && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-xs">Rest: {exercise.rest}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {exercise.notes && (
              <p className="mt-2 text-sm text-muted-foreground italic">
                {exercise.notes}
              </p>
            )}

            {/* Instructions collapsible */}
            {exercise.instructions && exercise.instructions.length > 0 && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2">
                    <Info className="h-4 w-4 mr-1" />
                    Instructions
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 ml-1 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground pl-2">
                    {exercise.instructions.map((instruction, i) => (
                      <li key={i}>{instruction}</li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
