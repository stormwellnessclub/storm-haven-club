import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserMembership {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  membership_type: string;
  membership_start_date: string;
  membership_end_date: string | null;
  status: string;
  photo_url: string | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useUserMembership() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-membership", user?.id],
    queryFn: async (): Promise<UserMembership | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserMembership | null;
    },
    enabled: !!user,
  });
}

export function getMembershipTierBenefits(tier: string): string[] {
  const tierBenefits: Record<string, string[]> = {
    Essential: [
      "Access to gym floor and equipment",
      "Locker room access",
      "10 monthly class credits",
      "Member pricing on class passes",
      "5% spa discount",
    ],
    Premium: [
      "All Essential benefits",
      "Priority class booking",
      "15 monthly class credits",
      "Guest passes (2 per month)",
      "8% spa discount",
      "Complimentary fitness assessment",
    ],
    Elite: [
      "All Premium benefits",
      "Unlimited class credits",
      "Priority spa booking",
      "Guest passes (4 per month)",
      "12% spa discount",
      "Personal training session monthly",
      "Exclusive member events",
      "Complimentary childcare",
    ],
  };

  return tierBenefits[tier] || tierBenefits["Essential"];
}
