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
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  single_class_pass_agreement_signed: boolean;
  single_class_pass_agreement_signed_at: string | null;
  class_package_agreement_signed: boolean;
  class_package_agreement_signed_at: string | null;
  sms_opt_in: boolean | null;
  sms_opt_in_at: string | null;
  sms_opt_out_at: string | null;
  sms_opt_in_source: string | null;
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
        // Fetch name/phone from profiles table to pre-populate
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: newProfile, error: insertError } = await supabase
          .from("non_member_profiles")
          .insert({
            user_id: user.id,
            email: user.email || null,
            first_name: existingProfile?.first_name || null,
            last_name: existingProfile?.last_name || null,
            phone: existingProfile?.phone || null,
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

  const signWaiver = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("non_member_profiles")
        .update({ waiver_signed: true, waiver_signed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
      toast.success("Liability Waiver signed successfully!");
    },
    onError: (err) => {
      toast.error("Failed to sign waiver: " + err.message);
    },
  });

  const signAgreementField = (field: "single_class_pass_agreement_signed" | "class_package_agreement_signed", label: string) =>
    useMutation({
      mutationFn: async () => {
        if (!user) throw new Error("Not authenticated");
        const { data, error } = await (supabase.from("non_member_profiles") as any)
          .update({ [field]: true, [`${field}_at`]: new Date().toISOString() })
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
        toast.success(`${label} signed successfully!`);
      },
      onError: (err: any) => {
        toast.error(`Failed to sign agreement: ${err.message}`);
      },
    });

  const signSingleClassPassAgreement = signAgreementField("single_class_pass_agreement_signed", "Single Class Pass Agreement");
  const signClassPackageAgreement = signAgreementField("class_package_agreement_signed", "Class Package Agreement");

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
    signWaiver: signWaiver.mutate,
    isSigningWaiver: signWaiver.isPending,
    signSingleClassPassAgreement: signSingleClassPassAgreement.mutate,
    isSigningSingleClassPassAgreement: signSingleClassPassAgreement.isPending,
    signClassPackageAgreement: signClassPackageAgreement.mutate,
    isSigningClassPackageAgreement: signClassPackageAgreement.isPending,
  };
}
