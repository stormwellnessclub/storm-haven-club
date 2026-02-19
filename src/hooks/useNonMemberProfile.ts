import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface NonMemberProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  stripe_customer_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  created_at: string;
  updated_at: string;
}

export function useNonMemberProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["non-member-profile", user?.id],
    queryFn: async (): Promise<NonMemberProfile | null> => {
      if (!user) return null;

      // Try to get existing profile
      const { data, error } = await supabase
        .from("non_member_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Auto-create profile if it doesn't exist
      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from("non_member_profiles")
          .insert({
            user_id: user.id,
            email: user.email || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newProfile as NonMemberProfile;
      }

      return data as NonMemberProfile;
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Pick<NonMemberProfile, "first_name" | "last_name" | "phone" | "email">>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("non_member_profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
      toast.success("Profile updated");
    },
    onError: (err) => {
      toast.error("Failed to update profile: " + err.message);
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
  };
}
