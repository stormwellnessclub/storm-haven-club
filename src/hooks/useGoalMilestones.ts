import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface GoalMilestone {
  id: string;
  goal_id: string;
  milestone_value: number;
  milestone_label: string | null;
  achieved_at: string | null;
  created_at: string;
}

export interface CreateMilestoneData {
  goal_id: string;
  milestone_value: number;
  milestone_label?: string;
}

export function useGoalMilestones(goalId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["goal-milestones", goalId],
    queryFn: async (): Promise<GoalMilestone[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("goal_milestones")
        .select("*")
        .eq("goal_id", goalId)
        .order("milestone_value", { ascending: true });

      if (error) throw error;
      return (data || []) as GoalMilestone[];
    },
    enabled: !!user && !!goalId,
  });
}

export function useCreateMilestone() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMilestoneData) => {
      if (!user) throw new Error("You must be signed in");

      const { data: milestone, error } = await supabase
        .from("goal_milestones")
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Check if milestone is already achieved
      await supabase.rpc("check_goal_milestones", {
        p_goal_id: data.goal_id,
      });

      return milestone as GoalMilestone;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goal-milestones", variables.goal_id] });
      toast.success("Milestone added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add milestone");
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId: string }) => {
      const { error } = await supabase
        .from("goal_milestones")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goal-milestones", variables.goalId] });
      toast.success("Milestone deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete milestone");
    },
  });
}

export function useCheckGoalMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string) => {
      const { data, error } = await supabase.rpc("check_goal_milestones", {
        p_goal_id: goalId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, goalId) => {
      queryClient.invalidateQueries({ queryKey: ["goal-milestones", goalId] });
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
    },
  });
}



