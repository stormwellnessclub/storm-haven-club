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

      try {
        const { data, error } = await (supabase.from as any)("habits")
          .select("*")
          .eq("member_id", targetMemberId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) {
          if (error.code === "42P01") {
            console.warn("Database table 'habits' not found. Returning empty array.");
            return [];
          }
          throw error;
        }
        return (data || []).map((h: any) => ({
          ...h,
          target_value: h.target_count || 1,
          unit: h.unit || null,
          category: h.category || null,
          color: h.color || null,
          icon: h.icon || null,
        })) as Habit[];
      } catch (error: any) {
        if (error.code === "42P01") {
          console.warn("Database table 'habits' not found. Returning empty array.");
          return [];
        }
        throw error;
      }
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

      try {
        const { data: habit, error } = await (supabase.from as any)("habits")
          .insert({
            name: data.name,
            description: data.description,
            member_id: member.id,
            user_id: user.id,
            frequency: data.frequency || "daily",
            target_count: data.target_value || data.target_count || 1,
            is_active: true,
            unit: data.unit || null,
            category: data.category || null,
            color: data.color || null,
            icon: data.icon || null,
          })
          .select()
          .single();

        if (error) {
          if (error.code === "42P01") {
            console.error("Database table 'habits' not found. Cannot create habit.");
            throw new Error("Habit system is temporarily unavailable.");
          }
          throw error;
        }
        return {
          ...habit,
          target_value: habit.target_count || 1,
          unit: habit.unit || null,
          category: habit.category || null,
        } as Habit;
      } catch (error: any) {
        if (error.code === "42P01") {
          console.error("Database table 'habits' not found. Cannot create habit.");
          throw new Error("Habit system is temporarily unavailable.");
        }
        throw error;
      }
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
      
      try {
        const { data: habit, error } = await (supabase.from as any)("habits")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          if (error.code === "42P01") {
            console.error("Database table 'habits' not found. Cannot update habit.");
            throw new Error("Habit system is temporarily unavailable.");
          }
          throw error;
        }
        return {
          ...habit,
          target_value: habit.target_count || 1,
        } as Habit;
      } catch (error: any) {
        if (error.code === "42P01") {
          console.error("Database table 'habits' not found. Cannot update habit.");
          throw new Error("Habit system is temporarily unavailable.");
        }
        throw error;
      }
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
      try {
        // Soft delete by setting is_active to false
        const { error } = await (supabase.from as any)("habits")
          .update({ is_active: false })
          .eq("id", id);

        if (error) {
          if (error.code === "42P01") {
            console.error("Database table 'habits' not found. Cannot delete habit.");
            throw new Error("Habit system is temporarily unavailable.");
          }
          throw error;
        }
      } catch (error: any) {
        if (error.code === "42P01") {
          console.error("Database table 'habits' not found. Cannot delete habit.");
          throw new Error("Habit system is temporarily unavailable.");
        }
        throw error;
      }
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
