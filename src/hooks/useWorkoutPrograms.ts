import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";

export interface ProgramPreferences {
  programType: string;
  daysPerWeek: number;
  durationWeeks: number;
  splitType: string;
  targetBodyParts: string[];
}

export interface WorkoutProgram {
  id: string;
  member_id: string;
  user_id: string;
  program_name: string;
  program_type: 'strength' | 'hypertrophy' | 'fat_loss' | 'endurance';
  duration_weeks: number;
  days_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  target_body_parts: string[];
  split_type: 'full_body' | 'upper_lower' | 'push_pull_legs' | 'bro_split' | null;
  progression_style: 'linear' | 'undulating' | 'block' | null;
  ai_reasoning: string | null;
  is_active: boolean;
  current_week: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramWorkout {
  id: string;
  program_id: string;
  week_number: number;
  day_number: number;
  workout_name: string;
  workout_type: string | null;
  focus_area: string | null;
  exercises: Exercise[];
  duration_minutes: number | null;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
  equipment?: string;
}

// Helper to parse exercises from Json to Exercise[]
function parseExercises(exercises: Json | null): Exercise[] {
  if (!exercises) return [];
  if (!Array.isArray(exercises)) return [];
  return exercises as unknown as Exercise[];
}

export function useWorkoutPrograms() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["workout-programs", user?.id],
    queryFn: async (): Promise<WorkoutProgram[]> => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("workout_programs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as WorkoutProgram[];
    },
    enabled: !!user?.id,
  });
}

export function useActiveProgram() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["active-program", user?.id],
    queryFn: async (): Promise<WorkoutProgram | null> => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("workout_programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WorkoutProgram | null;
    },
    enabled: !!user?.id,
  });
}

export function useProgramWorkouts(programId: string | undefined) {
  return useQuery({
    queryKey: ["program-workouts", programId],
    queryFn: async (): Promise<ProgramWorkout[]> => {
      if (!programId) return [];
      
      const { data, error } = await supabase
        .from("program_workouts")
        .select("*")
        .eq("program_id", programId)
        .order("week_number", { ascending: true })
        .order("day_number", { ascending: true });

      if (error) throw error;
      return (data || []).map(workout => ({
        ...workout,
        exercises: parseExercises(workout.exercises)
      })) as unknown as ProgramWorkout[];
    },
    enabled: !!programId,
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (program: Omit<WorkoutProgram, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("workout_programs")
        .insert(program)
        .select()
        .single();

      if (error) throw error;
      return data as WorkoutProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-programs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-program", user?.id] });
    },
    onError: (error) => {
      toast.error("Failed to create program: " + error.message);
    },
  });
}

export function useCreateProgramWorkouts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workouts: Omit<ProgramWorkout, "id" | "created_at" | "updated_at">[]) => {
      // Convert Exercise[] to Json for Supabase
      const workoutsForDb = workouts.map(w => ({
        ...w,
        exercises: w.exercises as unknown as Json
      }));
      
      const { data, error } = await supabase
        .from("program_workouts")
        .insert(workoutsForDb)
        .select();

      if (error) throw error;
      return (data || []).map(workout => ({
        ...workout,
        exercises: parseExercises(workout.exercises)
      })) as unknown as ProgramWorkout[];
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["program-workouts", variables[0].program_id] });
      }
    },
    onError: (error) => {
      toast.error("Failed to create workouts: " + error.message);
    },
  });
}

export function useCompleteProgramWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutId, programId }: { workoutId: string; programId: string }) => {
      const { data, error } = await supabase
        .from("program_workouts")
        .update({ 
          is_completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq("id", workoutId)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        exercises: parseExercises(data.exercises)
      } as unknown as ProgramWorkout;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["program-workouts", variables.programId] });
      toast.success("Workout marked as complete!");
    },
    onError: (error) => {
      toast.error("Failed to complete workout: " + error.message);
    },
  });
}

export function useUpdateProgramWeek() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ programId, currentWeek }: { programId: string; currentWeek: number }) => {
      const { data, error } = await supabase
        .from("workout_programs")
        .update({ current_week: currentWeek })
        .eq("id", programId)
        .select()
        .single();

      if (error) throw error;
      return data as WorkoutProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-programs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-program", user?.id] });
    },
  });
}

export function useCompleteProgram() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (programId: string) => {
      const { data, error } = await supabase
        .from("workout_programs")
        .update({ 
          is_active: false, 
          completed_at: new Date().toISOString() 
        })
        .eq("id", programId)
        .select()
        .single();

      if (error) throw error;
      return data as WorkoutProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-programs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-program", user?.id] });
      toast.success("Program completed! 🎉");
    },
    onError: (error) => {
      toast.error("Failed to complete program: " + error.message);
    },
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (programId: string) => {
      const { error } = await supabase
        .from("workout_programs")
        .delete()
        .eq("id", programId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-programs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-program", user?.id] });
      toast.success("Program deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete program: " + error.message);
    },
  });
}

export function useGenerateProgram() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (preferences: ProgramPreferences) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("ai-recommendations", {
        body: {
          type: "program_generation",
          preferences,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to generate program");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-programs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-program", user?.id] });
      toast.success("4-week program generated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to generate program: " + error.message);
    },
  });
}
