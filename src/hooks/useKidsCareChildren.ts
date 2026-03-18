import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface KidsCareChild {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  medications: string | null;
  special_instructions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  relationship_to_child: string | null;
  authorized_pickup_persons: string | null;
  photo_release: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddChildData {
  full_name: string;
  date_of_birth?: string;
  allergies?: string;
  medical_conditions?: string;
  medications?: string;
  special_instructions?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  relationship_to_child?: string;
  authorized_pickup_persons?: string;
  photo_release?: boolean;
}

export function useKidsCareChildren() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["kids-care-children", user?.id],
    queryFn: async (): Promise<KidsCareChild[]> => {
      if (!user) return [];

      const { data, error } = await (supabase
        .from("kids_care_children" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }) as any);

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }

      return (data || []) as KidsCareChild[];
    },
    enabled: !!user,
  });
}

export function useAddChild() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (childData: AddChildData) => {
      if (!user) throw new Error("Must be signed in");

      const { data, error } = await (supabase
        .from("kids_care_children" as any)
        .insert({
          user_id: user.id,
          full_name: childData.full_name,
          date_of_birth: childData.date_of_birth || null,
          allergies: childData.allergies || null,
          medical_conditions: childData.medical_conditions || null,
          medications: childData.medications || null,
          special_instructions: childData.special_instructions || null,
          emergency_contact_name: childData.emergency_contact_name || null,
          emergency_contact_phone: childData.emergency_contact_phone || null,
          relationship_to_child: childData.relationship_to_child || null,
          authorized_pickup_persons: childData.authorized_pickup_persons || null,
          photo_release: childData.photo_release || false,
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return data as KidsCareChild;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-children"] });
      toast.success("Child profile added successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add child profile");
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AddChildData> & { id: string }) => {
      const { data, error } = await (supabase
        .from("kids_care_children" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single() as any);

      if (error) throw error;
      return data as KidsCareChild;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-children"] });
      toast.success("Child profile updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update child profile");
    },
  });
}

export function useDeleteChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await (supabase
        .from("kids_care_children" as any)
        .update({ is_active: false } as any)
        .eq("id", childId) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-children"] });
      toast.success("Child profile removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove child profile");
    },
  });
}
