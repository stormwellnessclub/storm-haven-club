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
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: string;
    weight?: string;
    duration_seconds?: number;
    rest_seconds?: number;
    notes?: string;
  }>;
  performed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkoutLogData {
  workout_type: string;
  workout_name?: string;
  duration_minutes?: number;
  calories_burned?: number;
  notes?: string;
  exercises?: WorkoutLog["exercises"];
  performed_at?: string;
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

      let query = supabase
        .from("workout_logs")
        .select("*")
        .eq("member_id", targetMemberId)
        .order("performed_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as WorkoutLog[];
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

      const { data: workout, error } = await supabase
        .from("workout_logs")
        .insert({
          ...data,
          member_id: member.id,
          user_id: user.id,
          exercises: data.exercises || [],
          performed_at: data.performed_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return workout as WorkoutLog;
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
      const { data: workout, error } = await supabase
        .from("workout_logs")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return workout as WorkoutLog;
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
      const { error } = await supabase
        .from("workout_logs")
        .delete()
        .eq("id", id);

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



