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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  annual_fee_subscription_id: string | null;
  billing_type: string | null;
  is_founding_member: boolean | null;
  gender: string | null;
  annual_fee_paid_at: string | null;
  activation_deadline: string | null;
  activated_at: string | null;
  locked_start_date: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  // Phase 1: Founding perks tracking
  founding_privileges_granted: boolean | null;
  founding_privileges_granted_at: string | null;
  founding_perks_delivered_at: string | null;
  founding_sweater_size: string | null;
  founding_bag_size: string | null;
  // Phase 1: Tier change tracking
  tier_change_used: boolean | null;
  tier_change_used_at: string | null;
  original_tier_at_application: string | null;
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

export function getMembershipTierBenefits(
  tier: string, 
  isFoundingMember: boolean = false
): string[] {
  const tierBenefits: Record<string, string[]> = {
    Silver: [
      "Full access to state-of-the-art gym",
      "Wet spa amenities: sauna, steam room, Himalayan salt room, cold plunge",
      "Childcare add-on available ($75/month)",
      "Purchase classes à la carte or through class passes",
    ],
    Gold: [
      "All Silver benefits",
      "Red Light Therapy (4 sessions/month)",
      "Dry Cryo (2 sessions/month)",
      "Childcare add-on available ($75/month)",
      "Purchase classes à la carte or through class passes",
    ],
    Platinum: [
      "All Silver and Gold benefits",
      "Red Light Therapy (6 sessions/month)",
      "Dry Cryo (4 sessions/month)",
      "Childcare add-on available ($75/month)",
      "Purchase classes à la carte or through class passes",
    ],
    Diamond: [
      "All Silver and Gold benefits",
      "10 classes per month (Cycling, Pilates, Aerobics, HIIT, Dance)",
      "Red Light Therapy (10 sessions/month)",
      "Dry Cryo (6 sessions/month)",
      "Childcare add-on available ($75/month)",
    ],
  };

  // Normalize the tier name: lowercase, remove "membership" suffix
  const normalizedTier = tier
    ?.toLowerCase()
    .replace(" membership", "")
    .trim();
  
  // Map to proper case
  const tierMap: Record<string, string> = {
    silver: "Silver",
    gold: "Gold", 
    platinum: "Platinum",
    diamond: "Diamond",
  };
  
  const matchedTier = tierMap[normalizedTier] || "Silver";
  const baseBenefits = tierBenefits[matchedTier] || tierBenefits["Silver"];
  const isDiamond = matchedTier === "Diamond";
  
  // Diamond Founding Member - exclusive top-tier perks
  if (isDiamond && isFoundingMember) {
    return [
      ...baseBenefits,
      "---",
      "💎 Diamond Founding Member Exclusives:",
      "Personalized Storm Wellness Club sweater (exclusive founding design)",
      "Diamond Member personalized gym bag",
      "VIP amenity kit with premium products",
      "Diamond member personalized clothing line",
      "Priority booking for ALL classes and events",
    ];
  }
  
  // Regular Diamond Member perks
  if (isDiamond) {
    return [
      ...baseBenefits,
      "---",
      "💎 Diamond Member Perks:",
      "Diamond member personalized clothes",
      "Diamond member gear package",
      "VIP amenity kit",
      "Priority booking for all classes and events",
    ];
  }
  
  // All other Founding Members (Silver/Gold/Platinum)
  if (isFoundingMember) {
    return [
      ...baseBenefits,
      "---",
      "🌟 Founding Member Perks:",
      "Personalized Storm Wellness Club sweater (founding members only)",
      "Personalized gear package",
      "Priority booking for all classes and events",
    ];
  }
  
  return baseBenefits;
}
