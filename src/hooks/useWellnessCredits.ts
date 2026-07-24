import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WellnessCreditType } from "@/lib/wellnessCategories";

export interface WellnessCredit {
  id: string;
  credit_type: WellnessCreditType;
  credits_remaining: number;
  credits_total: number;
  cycle_start: string;
  cycle_end: string;
  expires_at: string;
}

export function useWellnessCredits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wellness-credits", user?.id],
    queryFn: async (): Promise<Record<WellnessCreditType, WellnessCredit | null>> => {
      const empty: Record<WellnessCreditType, WellnessCredit | null> = {
        red_light: null,
        dry_cryo: null,
        ozone: null,
      };
      if (!user) return empty;

      // Get member ID first
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "frozen"])
        .maybeSingle();

      if (!memberData) return empty;

      // Get current credits for red_light, dry_cryo, ozone
      const now = new Date().toISOString();
      const { data: credits, error } = await supabase
        .from("member_credits")
        .select("*")
        .eq("member_id", memberData.id)
        .in("credit_type", ["red_light", "dry_cryo", "ozone"] as any)
        .gt("credits_remaining", 0)
        .gte("expires_at", now)
        .order("expires_at", { ascending: true });

      if (error) {
        console.error("Error fetching wellness credits:", error);
        return empty;
      }

      // Get the first available credit for each type (earliest expiring)
      const result: Record<WellnessCreditType, WellnessCredit | null> = { ...empty };

      for (const credit of credits || []) {
        const creditType = credit.credit_type as WellnessCreditType;
        if (creditType in result && !result[creditType]) {
          result[creditType] = credit as WellnessCredit;
        }
      }

      return result;
    },
    enabled: !!user,
  });
}
