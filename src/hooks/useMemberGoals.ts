import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MemberGoal {
  id: string;
  member_id: string;
  goal_type: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  start_date: string;
  target_date: string | null;
  status: "active" | "completed" | "paused" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface CreateGoalData {
  goal_type: string;
  title: string;
  description?: string;
  target_value?: number;
  current_value?: number;
  unit?: string;
  start_date?: string;
  target_date?: string;
}

export function useMemberGoals(memberId?: string, status?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-goals", memberId || user?.id, status],
    queryFn: async (): Promise<MemberGoal[]> => {
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
        .from("member_goals")
        .select("*")
        .eq("member_id", targetMemberId)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as MemberGoal[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useCreateGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGoalData) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) throw new Error("Member not found");

      const { data: goal, error } = await supabase
        .from("member_goals")
        .insert({
          ...data,
          member_id: member.id,
          current_value: data.current_value || 0,
          status: "active",
          start_date: data.start_date || new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (error) throw error;
      return goal as MemberGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
      toast.success("Goal created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create goal");
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateGoalData & { status?: string }> }) => {
      const { data: goal, error } = await supabase
        .from("member_goals")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return goal as MemberGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-milestones"] });
      toast.success("Goal updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update goal");
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting status to cancelled
      const { error } = await supabase
        .from("member_goals")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-goals"] });
      toast.success("Goal cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel goal");
    },
  });
}



