import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export interface HabitLog {
  id: string;
  habit_id: string;
  member_id: string;
  logged_value: number;
  logged_date: string;
  notes: string | null;
  created_at: string;
}

export interface CreateHabitLogData {
  habit_id: string;
  logged_value?: number;
  logged_date?: string;
  notes?: string;
}

export function useHabitLogs(habitId?: string, memberId?: string, dateRange?: { start: Date; end: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["habit-logs", habitId, memberId || user?.id, dateRange],
    queryFn: async (): Promise<HabitLog[]> => {
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
        .from("habit_logs")
        .select("*")
        .eq("member_id", targetMemberId)
        .order("logged_date", { ascending: false });

      if (habitId) {
        query = query.eq("habit_id", habitId);
      }

      if (dateRange) {
        query = query
          .gte("logged_date", format(dateRange.start, "yyyy-MM-dd"))
          .lte("logged_date", format(dateRange.end, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as HabitLog[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useCreateHabitLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHabitLogData) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) throw new Error("Member not found");

      const { data: log, error } = await supabase
        .from("habit_logs")
        .insert({
          ...data,
          member_id: member.id,
          logged_value: data.logged_value || 1,
          logged_date: data.logged_date || format(new Date(), "yyyy-MM-dd"),
        })
        .select()
        .single();

      if (error) throw error;
      return log as HabitLog;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["habit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["habit-streaks"] });
      toast.success("Habit logged successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log habit");
    },
  });
}

export function useUpdateHabitLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateHabitLogData> }) => {
      const { data: log, error } = await supabase
        .from("habit_logs")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return log as HabitLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["habit-streaks"] });
      toast.success("Habit log updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update habit log");
    },
  });
}

export function useDeleteHabitLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("habit_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["habit-streaks"] });
      toast.success("Habit log deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete habit log");
    },
  });
}



