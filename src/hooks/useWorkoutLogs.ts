import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkoutLog {
  id: string;
  member_id: string;
  user_id: string;
  workout_type: string;
  workout_name: string | null;
  duration_minutes: number | null;
  calories_burned: number | null;
  notes: string | null;
  logged_at: string;
  performed_at: string;
  exercises: any[];
  created_at: string;
  updated_at: string;
}

export interface CreateWorkoutLogData {
  workout_type: string;
  workout_name?: string;
  duration_minutes?: number;
  calories_burned?: number;
  notes?: string;
  logged_at?: string;
  performed_at?: string;
  exercises?: any[];
}

export function useWorkoutLogs(memberId?: string, limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["workout-logs", memberId || user?.id, limit],
    queryFn: async (): Promise<WorkoutLog[]> => {
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

      let query = (supabase
        .from("workout_logs" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .order("logged_at", { ascending: false }) as any);

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((w: any) => ({
        ...w,
        performed_at: w.logged_at,
        workout_name: w.workout_type,
        exercises: [],
        updated_at: w.created_at,
      })) as WorkoutLog[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useCreateWorkoutLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWorkoutLogData) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) throw new Error("Member not found");

      const loggedAt = data.performed_at || data.logged_at || new Date().toISOString();

      const { data: workout, error } = await (supabase
        .from("workout_logs" as any)
        .insert({
          workout_type: data.workout_name || data.workout_type,
          member_id: member.id,
          user_id: user.id,
          duration_minutes: data.duration_minutes,
          calories_burned: data.calories_burned,
          notes: data.notes,
          logged_at: loggedAt,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...workout,
        performed_at: workout.logged_at,
        workout_name: workout.workout_type,
        exercises: data.exercises || [],
        updated_at: workout.created_at,
      } as WorkoutLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-logs"] });
      queryClient.invalidateQueries({ queryKey: ["member-activities"] });
      toast.success("Workout logged successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log workout");
    },
  });
}

export function useUpdateWorkoutLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateWorkoutLogData> }) => {
      const updateData: any = {};
      if (data.workout_type !== undefined) updateData.workout_type = data.workout_type;
      if (data.workout_name !== undefined) updateData.workout_type = data.workout_name;
      if (data.duration_minutes !== undefined) updateData.duration_minutes = data.duration_minutes;
      if (data.calories_burned !== undefined) updateData.calories_burned = data.calories_burned;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.logged_at !== undefined) updateData.logged_at = data.logged_at;
      if (data.performed_at !== undefined) updateData.logged_at = data.performed_at;

      const { data: workout, error } = await (supabase
        .from("workout_logs" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...workout,
        performed_at: workout.logged_at,
        workout_name: workout.workout_type,
        exercises: [],
        updated_at: workout.created_at,
      } as WorkoutLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-logs"] });
      toast.success("Workout updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update workout");
    },
  });
}

export function useDeleteWorkoutLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("workout_logs" as any)
        .delete()
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-logs"] });
      toast.success("Workout deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete workout");
    },
  });
}
