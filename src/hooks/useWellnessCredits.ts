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
      if (!user) {
        return { red_light: null, dry_cryo: null };
      }

      // Get member ID first
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "frozen"])
        .maybeSingle();

      if (!memberData) {
        return { red_light: null, dry_cryo: null };
      }

      // Get current credits for red_light and dry_cryo
      const now = new Date().toISOString();
      const { data: credits, error } = await supabase
        .from("member_credits")
        .select("*")
        .eq("member_id", memberData.id)
        .in("credit_type", ["red_light", "dry_cryo"])
        .gt("credits_remaining", 0)
        .gte("expires_at", now)
        .order("expires_at", { ascending: true });

      if (error) {
        console.error("Error fetching wellness credits:", error);
        return { red_light: null, dry_cryo: null };
      }

      // Get the first available credit for each type (earliest expiring)
      const result: Record<WellnessCreditType, WellnessCredit | null> = {
        red_light: null,
        dry_cryo: null,
      };

      for (const credit of credits || []) {
        const creditType = credit.credit_type as WellnessCreditType;
        if (!result[creditType]) {
          result[creditType] = credit as WellnessCredit;
        }
      }

      return result;
    },
    enabled: !!user,
  });
}
