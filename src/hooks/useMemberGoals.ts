import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MemberGoal {
  id: string;
  member_id: string;
  user_id: string;
  goal_type: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string | null;
  start_date: string;
  target_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalData {
  goal_type: string;
  title?: string;
  description?: string;
  target_value: number;
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

      let query = (supabase
        .from("member_goals" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .order("created_at", { ascending: false }) as any);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g,
        title: g.goal_type,
        description: null,
      })) as MemberGoal[];
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

      const { data: goal, error } = await (supabase
        .from("member_goals" as any)
        .insert({
          goal_type: data.title || data.goal_type,
          target_value: data.target_value,
          member_id: member.id,
          user_id: user.id,
          current_value: data.current_value || 0,
          unit: data.unit,
          status: "active",
          start_date: data.start_date || new Date().toISOString().split("T")[0],
          target_date: data.target_date,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...goal,
        title: goal.goal_type,
        description: null,
      } as MemberGoal;
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
      const updateData: any = { ...data };
      if (data.title !== undefined) {
        updateData.goal_type = data.title;
        delete updateData.title;
      }
      if (data.description !== undefined) {
        delete updateData.description;
      }
      
      const { data: goal, error } = await (supabase
        .from("member_goals" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...goal,
        title: goal.goal_type,
        description: null,
      } as MemberGoal;
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
      const { error } = await (supabase
        .from("member_goals" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", id) as any);

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
