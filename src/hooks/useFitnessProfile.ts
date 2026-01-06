import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FitnessProfile {
  id: string;
  member_id: string;
  user_id: string;
  fitness_level: "beginner" | "intermediate" | "advanced" | null;
  primary_goal: string | null;
  secondary_goals: string[];
  available_equipment: string[];
  equipment_ids?: string[]; // UUID array for equipment
  available_time_minutes: number;
  workout_preferences: Record<string, any>;
  injuries_limitations: string[];
  updated_at: string;
}

export interface UpdateFitnessProfileData {
  fitness_level?: "beginner" | "intermediate" | "advanced";
  primary_goal?: string;
  secondary_goals?: string[];
  available_equipment?: string[];
  equipment_ids?: string[]; // UUID array for equipment
  available_time_minutes?: number;
  workout_preferences?: Record<string, any>;
  injuries_limitations?: string[];
}

export function useFitnessProfile(memberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["fitness-profile", memberId || user?.id],
    queryFn: async (): Promise<FitnessProfile | null> => {
      if (!user) return null;

      // Get member_id if not provided
      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!member) return null;
        targetMemberId = member.id;
      }

      const { data, error } = await (supabase
        .from("member_fitness_profiles" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .maybeSingle() as any);

      if (error) throw error;
      return data as FitnessProfile | null;
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useCreateFitnessProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateFitnessProfileData) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) throw new Error("Member not found");

      const insertData: any = {
        ...data,
        member_id: member.id,
        user_id: user.id,
        secondary_goals: data.secondary_goals || [],
        available_equipment: data.available_equipment || [],
        workout_preferences: data.workout_preferences || {},
        injuries_limitations: data.injuries_limitations || [],
        available_time_minutes: data.available_time_minutes || 30,
      };
      
      // Include equipment_ids if provided
      if (data.equipment_ids !== undefined) {
        insertData.equipment_ids = data.equipment_ids;
      }

      const { data: profile, error } = await (supabase
        .from("member_fitness_profiles" as any)
        .insert(insertData)
        .select()
        .single() as any);

      if (error) throw error;
      return profile as FitnessProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fitness-profile"] });
      toast.success("Fitness profile created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create fitness profile");
    },
  });
}

export function useUpdateFitnessProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, data }: { memberId?: string; data: UpdateFitnessProfileData }) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id if not provided
      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!member) throw new Error("Member not found");
        targetMemberId = member.id;
      }

      const updateData: any = { ...data };
      // Ensure equipment_ids is included if provided
      if (data.equipment_ids !== undefined) {
        updateData.equipment_ids = data.equipment_ids;
      }

      const { data: profile, error } = await (supabase
        .from("member_fitness_profiles" as any)
        .update(updateData)
        .eq("member_id", targetMemberId)
        .select()
        .single() as any);

      if (error) throw error;
      return profile as FitnessProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fitness-profile"] });
      toast.success("Fitness profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update fitness profile");
    },
  });
}



