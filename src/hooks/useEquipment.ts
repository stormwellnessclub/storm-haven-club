import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Equipment {
  id: string;
  name: string;
  category: "cardio" | "strength" | "functional" | "free_weights" | "machines" | "accessories" | "recovery";
  description: string | null;
  image_url: string | null;
  technogym_id: string | null;
  technogym_exercise_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useEquipment(category?: string) {
  return useQuery({
    queryKey: ["equipment", category],
    queryFn: async (): Promise<Equipment[]> => {
      let query = (supabase
        .from("equipment" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }) as any);

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Equipment[];
    },
  });
}

export function useAllEquipment() {
  return useEquipment();
}

export function useEquipmentByCategory(category: Equipment["category"]) {
  return useEquipment(category);
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipment: Omit<Equipment, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase
        .from("equipment" as any)
        .insert(equipment as any)
        .select()
        .single() as any);

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Equipment added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add equipment: " + error.message);
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Equipment> & { id: string }) => {
      const { data, error } = await (supabase
        .from("equipment" as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Equipment updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update equipment: " + error.message);
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { data, error } = await (supabase
        .from("equipment" as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Equipment deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete equipment: " + error.message);
    },
  });
}

