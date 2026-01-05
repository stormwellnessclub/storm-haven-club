import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface GoalProgressLog {
  id: string;
  goal_id: string;
  progress_value: number;
  logged_at: string;
  notes: string | null;
}

export interface CreateProgressLogData {
  goal_id: string;
  progress_value: number;
  notes?: string;
  logged_at?: string;
}

export function useGoalProgress(goalId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["goal-progress", goalId],
    queryFn: async (): Promise<GoalProgressLog[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("goal_progress_logs")
        .select("*")
        .eq("goal_id", goalId)
        .order("logged_at", { ascending: false });

      if (error) throw error;
      return (data || []) as GoalProgressLog[];
    },
    enabled: !!user && !!goalId,
  });
}

export function useLogGoalProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProgressLogData) => {
      if (!user) throw new Error("You must be signed in");

      const { data: log, error } = await supabase
        .from("goal_progress_logs")
        .insert({
          ...data,
          logged_at: data.logged_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Check milestones (triggered automatically by database trigger)
      // But we can also manually trigger if needed
      await supabase.rpc("check_goal_milestones", {
        p_goal_id: data.goal_id,
      });

      return log as GoalProgressLog;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goal-progress", variables.goal_id] });
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-milestones", variables.goal_id] });
      toast.success("Progress logged successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log progress");
    },
  });
}

export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProgressLogData> }) => {
      const { data: log, error } = await supabase
        .from("goal_progress_logs")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return log as GoalProgressLog;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["goal-progress", data.goal_id] });
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
      toast.success("Progress log updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update progress log");
    },
  });
}

export function useDeleteGoalProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId: string }) => {
      const { error } = await supabase
        .from("goal_progress_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goal-progress", variables.goalId] });
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
      toast.success("Progress log deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete progress log");
    },
  });
}



