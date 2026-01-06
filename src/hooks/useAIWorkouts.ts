import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkoutPreferences {
  workoutType: string;
  targetBodyParts: string[];
  duration: number;
  intensity: string;
}

export interface AIWorkoutExercise {
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

export interface AIWorkout {
  id: string;
  member_id: string;
  workout_name: string;
  workout_type: string;
  duration_minutes: number | null;
  difficulty: string | null;
  exercises: AIWorkoutExercise[];
  ai_reasoning: string | null;
  generated_at: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export function useAIWorkouts(memberId?: string, limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ai-workouts", memberId || user?.id, limit],
    queryFn: async (): Promise<AIWorkout[]> => {
      if (!user) return [];

      // Get member_id if not provided
      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!member) return [];
        targetMemberId = member.id;
      }

      try {
        let query = (supabase.from as any)("ai_workouts")
          .select("*")
          .eq("member_id", targetMemberId)
          .order("created_at", { ascending: false });

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
          // Table might not exist yet - return empty array
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("ai_workouts table not found, returning empty array");
            return [];
          }
          throw error;
        }
        return (data || []) as AIWorkout[];
      } catch (error: any) {
        // Handle table not existing gracefully
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("ai_workouts table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useGenerateAIWorkout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: WorkoutPreferences) => {
      if (!user) throw new Error("You must be signed in");

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Authentication token not found");

      const response = await supabase.functions.invoke("ai-recommendations", {
        body: {
          type: "workout_generation",
          preferences: {
            workoutType: preferences.workoutType,
            targetBodyParts: preferences.targetBodyParts,
            duration: preferences.duration,
            intensity: preferences.intensity,
          },
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workouts"] });
      toast.success("AI workout generated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate workout");
    },
  });
}

export function useUpdateAIWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AIWorkout> }) => {
      try {
        const { data: workout, error } = await (supabase.from as any)("ai_workouts")
          .update(data)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("AI Workouts feature is not yet available. Please check back later.");
          }
          throw error;
        }
        return workout as AIWorkout;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("AI Workouts feature is not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workouts"] });
      toast.success("Workout updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update workout");
    },
  });
}

export function useCompleteAIWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { data: workout, error } = await (supabase.from as any)("ai_workouts")
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("AI Workouts feature is not yet available. Please check back later.");
          }
          throw error;
        }
        return workout as AIWorkout;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("AI Workouts feature is not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workouts"] });
      toast.success("Workout marked as completed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to complete workout");
    },
  });
}

export function useDeleteAIWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await (supabase.from as any)("ai_workouts")
          .delete()
          .eq("id", id);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("AI Workouts feature is not yet available. Please check back later.");
          }
          throw error;
        }
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("AI Workouts feature is not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workouts"] });
      toast.success("Workout deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete workout");
    },
  });
}



