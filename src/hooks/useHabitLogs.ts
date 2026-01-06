import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  logged_at: string;
  logged_date: string;
  logged_value: number;
  count: number;
  notes: string | null;
  created_at: string;
}

export interface CreateHabitLogData {
  habit_id: string;
  count?: number;
  logged_value?: number;
  logged_at?: string;
  logged_date?: string;
  notes?: string;
}

export function useHabitLogs(habitId?: string, memberId?: string, dateRange?: { start: Date; end: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["habit-logs", habitId, memberId || user?.id, dateRange],
    queryFn: async (): Promise<HabitLog[]> => {
      if (!user) return [];

      let query = (supabase
        .from("habit_logs" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false }) as any);

      if (habitId) {
        query = query.eq("habit_id", habitId);
      }

      if (dateRange) {
        query = query
          .gte("logged_at", format(dateRange.start, "yyyy-MM-dd"))
          .lte("logged_at", format(dateRange.end, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map((log: any) => ({
        ...log,
        logged_date: log.logged_at,
        logged_value: log.count || 1,
      })) as HabitLog[];
    },
    enabled: !!user,
  });
}

export function useCreateHabitLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHabitLogData) => {
      if (!user) throw new Error("You must be signed in");

      const logDate = data.logged_date || data.logged_at || format(new Date(), "yyyy-MM-dd");
      const logValue = data.logged_value || data.count || 1;

      const { data: log, error } = await (supabase
        .from("habit_logs" as any)
        .insert({
          habit_id: data.habit_id,
          user_id: user.id,
          count: logValue,
          logged_at: logDate,
          notes: data.notes,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...log,
        logged_date: log.logged_at,
        logged_value: log.count || 1,
      } as HabitLog;
    },
    onSuccess: () => {
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
      const updateData: any = {};
      if (data.count !== undefined) updateData.count = data.count;
      if (data.logged_value !== undefined) updateData.count = data.logged_value;
      if (data.logged_at !== undefined) updateData.logged_at = data.logged_at;
      if (data.logged_date !== undefined) updateData.logged_at = data.logged_date;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const { data: log, error } = await (supabase
        .from("habit_logs" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...log,
        logged_date: log.logged_at,
        logged_value: log.count || 1,
      } as HabitLog;
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
      const { error } = await (supabase
        .from("habit_logs" as any)
        .delete()
        .eq("id", id) as any);

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
