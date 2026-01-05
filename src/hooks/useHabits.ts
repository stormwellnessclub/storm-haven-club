import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Habit {
  id: string;
  member_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  frequency: string;
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
  target_value?: number;
  unit?: string;
  color?: string;
  icon?: string;
}

export function useHabits(memberId?: string, includeSystem: boolean = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["habits", memberId || user?.id, includeSystem],
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

      let query = supabase
        .from("habits")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (includeSystem) {
        query = query.or(`member_id.eq.${targetMemberId},member_id.is.null`);
      } else {
        query = query.eq("member_id", targetMemberId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Habit[];
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

      const { data: habit, error } = await supabase
        .from("habits")
        .insert({
          ...data,
          member_id: member.id,
          frequency: data.frequency || "daily",
          target_value: data.target_value || 1,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return habit as Habit;
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
      const { data: habit, error } = await supabase
        .from("habits")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return habit as Habit;
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
      const { error } = await supabase
        .from("habits")
        .update({ is_active: false })
        .eq("id", id);

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



