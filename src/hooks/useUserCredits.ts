import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface ClassPass {
  id: string;
  category: "pilates_cycling" | "other";
  pass_type: string;
  classes_total: number;
  classes_remaining: number;
  expires_at: string;
  status: "active" | "expired" | "exhausted";
  is_member_price: boolean;
}

export interface MemberCredits {
  id: string;
  credits_total: number;
  credits_remaining: number;
  month_year: string;
  expires_at: string;
}

export interface UserCreditsData {
  isMember: boolean;
  memberCredits: MemberCredits | null;
  classPasses: ClassPass[];
}

export function useUserCredits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async (): Promise<UserCreditsData> => {
      if (!user) {
        return { isMember: false, memberCredits: null, classPasses: [] };
      }

      // Check if user is a member
      const { data: member } = await supabase
        .from("members")
        .select("id, membership_type, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      const isMember = !!member;

      // Get member credits if applicable
      let memberCredits: MemberCredits | null = null;
      if (isMember) {
        const currentMonth = format(new Date(), "yyyy-MM");
        const { data: credits } = await supabase
          .from("class_credits")
          .select("*")
          .eq("user_id", user.id)
          .eq("month_year", currentMonth)
          .single();

        if (credits) {
          memberCredits = credits as MemberCredits;
        }
      }

      // Get active class passes
      const today = new Date().toISOString();
      const { data: passes } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", today)
        .gt("classes_remaining", 0)
        .order("expires_at");

      return {
        isMember,
        memberCredits,
        classPasses: (passes || []) as ClassPass[],
      };
    },
    enabled: !!user,
  });
}

export function useAvailableCreditsForCategory(category: "pilates_cycling" | "other") {
  const { data: creditsData, ...rest } = useUserCredits();

  const availablePasses = creditsData?.classPasses.filter(
    (pass) => pass.category === category && pass.classes_remaining > 0
  ) || [];

  const hasMemberCredits =
    creditsData?.isMember &&
    creditsData?.memberCredits &&
    creditsData.memberCredits.credits_remaining > 0;

  return {
    data: {
      hasMemberCredits,
      memberCreditsRemaining: creditsData?.memberCredits?.credits_remaining || 0,
      availablePasses,
      totalPassCredits: availablePasses.reduce((sum, p) => sum + p.classes_remaining, 0),
    },
    ...rest,
  };
}
