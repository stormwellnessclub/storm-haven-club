import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  fitness_goals: string | null;
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  membership_agreement_signed: boolean;
  membership_agreement_signed_at: string | null;
  kids_care_agreement_signed: boolean;
  kids_care_agreement_signed_at: string | null;
  kids_care_service_form_completed: boolean;
  kids_care_service_form_completed_at: string | null;
  class_package_agreement_signed: boolean;
  class_package_agreement_signed_at: string | null;
  guest_pass_agreement_signed: boolean;
  guest_pass_agreement_signed_at: string | null;
  private_event_agreement_signed: boolean;
  private_event_agreement_signed_at: string | null;
  single_class_pass_agreement_signed: boolean;
  single_class_pass_agreement_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  date_of_birth?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  fitness_goals?: string | null;
  waiver_signed?: boolean;
  waiver_signed_at?: string | null;
  membership_agreement_signed?: boolean;
  membership_agreement_signed_at?: string | null;
  kids_care_agreement_signed?: boolean;
  kids_care_agreement_signed_at?: string | null;
  kids_care_service_form_completed?: boolean;
  kids_care_service_form_completed_at?: string | null;
  class_package_agreement_signed?: boolean;
  class_package_agreement_signed_at?: string | null;
  guest_pass_agreement_signed?: boolean;
  guest_pass_agreement_signed_at?: string | null;
  private_event_agreement_signed?: boolean;
  private_event_agreement_signed_at?: string | null;
  single_class_pass_agreement_signed?: boolean;
  single_class_pass_agreement_signed_at?: string | null;
}

export function useUserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: UpdateProfileData) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  const signWaiverMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          waiver_signed: true,
          waiver_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Waiver signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign waiver: " + error.message);
    },
  });

  const signMembershipAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          membership_agreement_signed: true,
          membership_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Membership agreement signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign agreement: " + error.message);
    },
  });

  // Kids Care Agreement (both PDFs must be viewed/signed)
  const signKidsCareAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          kids_care_agreement_signed: true,
          kids_care_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Kids Care agreement signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign Kids Care agreement: " + error.message);
    },
  });

  // Class Package Agreement
  const signClassPackageAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          class_package_agreement_signed: true,
          class_package_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Class Package agreement signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign agreement: " + error.message);
    },
  });

  // Guest Pass Agreement
  const signGuestPassAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          guest_pass_agreement_signed: true,
          guest_pass_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Guest Pass agreement signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign agreement: " + error.message);
    },
  });

  // Private Event Agreement
  const signPrivateEventAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          private_event_agreement_signed: true,
          private_event_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Private Event agreement signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign agreement: " + error.message);
    },
  });

  // Single Class Pass Agreement
  const signSingleClassPassAgreementMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          single_class_pass_agreement_signed: true,
          single_class_pass_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Single Class Pass agreement signed successfully");
    },
    onError: (error) => {
      toast.error("Failed to sign agreement: " + error.message);
    },
  });

  // Complete Kids Care Service Form
  const completeKidsCareServiceFormMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update({
          kids_care_service_form_completed: true,
          kids_care_service_form_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Kids Care service form completed successfully");
    },
    onError: (error) => {
      toast.error("Failed to complete form: " + error.message);
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    signWaiver: signWaiverMutation.mutate,
    isSigningWaiver: signWaiverMutation.isPending,
    signMembershipAgreement: signMembershipAgreementMutation.mutate,
    isSigningAgreement: signMembershipAgreementMutation.isPending,
    signKidsCareAgreement: signKidsCareAgreementMutation.mutate,
    isSigningKidsCareAgreement: signKidsCareAgreementMutation.isPending,
    signClassPackageAgreement: signClassPackageAgreementMutation.mutate,
    isSigningClassPackageAgreement: signClassPackageAgreementMutation.isPending,
    signGuestPassAgreement: signGuestPassAgreementMutation.mutate,
    isSigningGuestPassAgreement: signGuestPassAgreementMutation.isPending,
    signPrivateEventAgreement: signPrivateEventAgreementMutation.mutate,
    isSigningPrivateEventAgreement: signPrivateEventAgreementMutation.isPending,
    signSingleClassPassAgreement: signSingleClassPassAgreementMutation.mutate,
    isSigningSingleClassPassAgreement: signSingleClassPassAgreementMutation.isPending,
    completeKidsCareServiceForm: completeKidsCareServiceFormMutation.mutate,
    isCompletingKidsCareServiceForm: completeKidsCareServiceFormMutation.isPending,
  };
}
