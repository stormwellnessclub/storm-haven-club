import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Habit {
  id: string;
  member_id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  frequency: string;
  target_count: number;
  target_value: number;
  unit: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHabitData {
  name: string;
  description?: string;
  category?: string;
  frequency?: string;
  target_count?: number;
  target_value?: number;
  unit?: string;
  color?: string;
  icon?: string;
}

export function useHabits(memberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["habits", memberId || user?.id],
    queryFn: async (): Promise<Habit[]> => {
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

      const { data, error } = await (supabase
        .from("habits" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data || []).map((h: any) => ({
        ...h,
        target_value: h.target_count || 1,
        unit: h.unit || null,
        category: h.category || null,
        color: h.color || null,
        icon: h.icon || null,
      })) as Habit[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useCreateHabit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHabitData) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) throw new Error("Member not found");

      const { data: habit, error } = await (supabase
        .from("habits" as any)
        .insert({
          name: data.name,
          description: data.description,
          member_id: member.id,
          user_id: user.id,
          frequency: data.frequency || "daily",
          target_count: data.target_value || data.target_count || 1,
          is_active: true,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...habit,
        target_value: habit.target_count || 1,
        unit: data.unit || null,
        category: data.category || null,
      } as Habit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create habit");
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateHabitData> }) => {
      const updateData: any = { ...data };
      if (data.target_value !== undefined) {
        updateData.target_count = data.target_value;
      }
      
      const { data: habit, error } = await (supabase
        .from("habits" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return {
        ...habit,
        target_value: habit.target_count || 1,
      } as Habit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update habit");
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await (supabase
        .from("habits" as any)
        .update({ is_active: false } as any)
        .eq("id", id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete habit");
    },
  });
}

// Re-export useHabitStreaks from the proper module
export { useHabitStreaks } from "./useHabitStreaks";
