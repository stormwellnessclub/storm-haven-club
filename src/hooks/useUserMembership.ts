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
      "All Platinum benefits",
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
  return tierBenefits[matchedTier] || tierBenefits["Silver"];
}
