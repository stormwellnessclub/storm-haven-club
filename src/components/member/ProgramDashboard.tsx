import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Trophy,
  Trash2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { 
  useProgramWorkouts, 
  useCompleteProgramWorkout, 
  useCompleteProgram,
  useDeleteProgram,
  type WorkoutProgram 
} from "@/hooks/useWorkoutPrograms";
import { ProgramWorkoutCard } from "./ProgramWorkoutCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProgramDashboardProps {
  program: WorkoutProgram;
  onProgramDeleted?: () => void;
  onRegenerateProgram?: () => void;
}

export function ProgramDashboard({ program, onProgramDeleted, onRegenerateProgram }: ProgramDashboardProps) {
  const [currentWeek, setCurrentWeek] = useState(program.current_week || 1);
  const { data: workouts = [], isLoading } = useProgramWorkouts(program.id);
  const completeWorkout = useCompleteProgramWorkout();
  const completeProgram = useCompleteProgram();
  const deleteProgram = useDeleteProgram();

  // Group workouts by week
  const workoutsByWeek = workouts.reduce((acc, workout) => {
    const week = workout.week_number;
    if (!acc[week]) acc[week] = [];
    acc[week].push(workout);
    return acc;
  }, {} as Record<number, typeof workouts>);

  // Calculate progress
  const totalWorkouts = workouts.length;
  const completedWorkouts = workouts.filter(w => w.is_completed).length;
  const progressPercent = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

  // Check if current week is complete
  const currentWeekWorkouts = workoutsByWeek[currentWeek] || [];
  const currentWeekComplete = currentWeekWorkouts.length > 0 && 
    currentWeekWorkouts.every(w => w.is_completed);

  // Check if entire program is complete
  const programComplete = totalWorkouts > 0 && completedWorkouts === totalWorkouts;

  const handleCompleteWorkout = async (workoutId: string) => {
    await completeWorkout.mutateAsync({ workoutId, programId: program.id });
  };

  const handleCompleteProgram = async () => {
    await completeProgram.mutateAsync(program.id);
  };

  const handleDeleteProgram = async () => {
    await deleteProgram.mutateAsync(program.id);
    onProgramDeleted?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Program Header */}
      <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{program.program_name}</CardTitle>
              <CardDescription className="mt-1">
                {program.duration_weeks}-week {program.program_type} program • {program.days_per_week} days/week
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="capitalize">
                {program.difficulty || 'intermediate'}
              </Badge>
              {program.split_type && (
                <Badge variant="secondary" className="capitalize">
                  {program.split_type.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{completedWorkouts} / {totalWorkouts} workouts</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* AI Reasoning */}
          {program.ai_reasoning && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm">
              <p className="text-muted-foreground">{program.ai_reasoning}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            {programComplete ? (
              <Button onClick={handleCompleteProgram} className="gap-2">
                <Trophy className="h-4 w-4" />
                Complete Program
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Started {program.started_at 
                  ? new Date(program.started_at).toLocaleDateString() 
                  : new Date(program.created_at).toLocaleDateString()}
              </div>
            )}
            
            <div className="flex gap-2">
              {/* Start New Program Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <RefreshCw className="h-4 w-4" />
                    New Program
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start a New Program?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace your current program "{program.program_name}" with a new one. Your current progress will be saved but the program will be deactivated.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRegenerateProgram?.()}>
                      Start New Program
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Program?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{program.program_name}" and all its workouts. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProgram} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week Tabs */}
      <Tabs value={`week-${currentWeek}`} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
            disabled={currentWeek === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <TabsList className="flex-1 mx-2 grid grid-cols-4">
            {[1, 2, 3, 4].slice(0, program.duration_weeks).map(week => {
              const weekWorkouts = workoutsByWeek[week] || [];
              const weekComplete = weekWorkouts.length > 0 && weekWorkouts.every(w => w.is_completed);
              
              return (
                <TabsTrigger 
                  key={week} 
                  value={`week-${week}`}
                  onClick={() => setCurrentWeek(week)}
                  className="relative"
                >
                  Week {week}
                  {weekComplete && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setCurrentWeek(w => Math.min(program.duration_weeks, w + 1))}
            disabled={currentWeek === program.duration_weeks}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week Content */}
        {[1, 2, 3, 4].slice(0, program.duration_weeks).map(week => (
          <TabsContent key={week} value={`week-${week}`} className="space-y-4 mt-0">
            {currentWeekComplete && week === currentWeek && (
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <CardContent className="py-4 flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-green-600" />
                  <p className="text-green-700 dark:text-green-400 font-medium">
                    Week {week} Complete! Great work! 🎉
                  </p>
                </CardContent>
              </Card>
            )}

            {(workoutsByWeek[week] || []).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No workouts scheduled for Week {week}</p>
                </CardContent>
              </Card>
            ) : (
              (workoutsByWeek[week] || []).map(workout => (
                <ProgramWorkoutCard
                  key={workout.id}
                  workout={workout}
                  onComplete={() => handleCompleteWorkout(workout.id)}
                  isCompleting={completeWorkout.isPending}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
