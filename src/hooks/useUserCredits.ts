import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CreditType } from "@/lib/memberCredits";

export interface ClassPass {
  id: string;
  category: "reformer" | "cycling" | "aerobics" | "other" | "pilates_cycling";
  pass_type: string;
  classes_total: number;
  classes_remaining: number;
  expires_at: string;
  status: "active" | "expired" | "exhausted";
  is_member_price: boolean;
}

export interface MemberCredit {
  id: string;
  credit_type: CreditType;
  credits_total: number;
  credits_remaining: number;
  cycle_start: string;
  cycle_end: string;
  expires_at: string;
}

export interface UserCreditsData {
  isMember: boolean;
  membershipType: string | null;
  classCredits: MemberCredit | null;
  redLightCredits: MemberCredit | null;
  dryCredits: MemberCredit | null;
  classPasses: ClassPass[];
}

export function useUserCredits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async (): Promise<UserCreditsData> => {
      if (!user) {
        return {
          isMember: false,
          membershipType: null,
          classCredits: null,
          redLightCredits: null,
          dryCredits: null,
          classPasses: [],
        };
      }

      // Check if user is a member
      const { data: member } = await supabase
        .from("members")
        .select("id, membership_type, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      const isMember = !!member;
      const membershipType = member?.membership_type || null;

      // Get active member credits (not expired)
      let classCredits: MemberCredit | null = null;
      let redLightCredits: MemberCredit | null = null;
      let dryCredits: MemberCredit | null = null;

      if (isMember) {
        const now = new Date().toISOString();
        const { data: credits } = await supabase
          .from("member_credits")
          .select("*")
          .eq("user_id", user.id)
          .gt("expires_at", now)
          .order("expires_at", { ascending: true });

        if (credits) {
          // Get the most recent active credit for each type
          for (const credit of credits) {
            const typedCredit = credit as unknown as MemberCredit;
            switch (typedCredit.credit_type) {
              case "class":
                if (!classCredits) classCredits = typedCredit;
                break;
              case "red_light":
                if (!redLightCredits) redLightCredits = typedCredit;
                break;
              case "dry_cryo":
                if (!dryCredits) dryCredits = typedCredit;
                break;
            }
          }
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
        membershipType,
        classCredits,
        redLightCredits,
        dryCredits,
        classPasses: (passes || []) as ClassPass[],
      };
    },
    enabled: !!user,
  });
}

export function useAvailableCreditsForCategory(category: "reformer" | "cycling" | "aerobics" | "other" | "pilates_cycling") {
  const { data: creditsData, ...rest } = useUserCredits();

  const availablePasses = creditsData?.classPasses.filter(
    (pass) => pass.category === category && pass.classes_remaining > 0
  ) || [];

  const hasClassCredits =
    creditsData?.isMember &&
    creditsData?.classCredits &&
    creditsData.classCredits.credits_remaining > 0;

  return {
    data: {
      hasClassCredits,
      classCreditsRemaining: creditsData?.classCredits?.credits_remaining || 0,
      availablePasses,
      totalPassCredits: availablePasses.reduce((sum, p) => sum + p.classes_remaining, 0),
    },
    ...rest,
  };
}
