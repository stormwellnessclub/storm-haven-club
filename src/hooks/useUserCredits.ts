import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CreditType } from "@/lib/memberCredits";
import { isPassValidForClass } from "@/lib/classCategories";

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
  memberStatus: string | null;
  memberId: string | null;
  classCredits: MemberCredit | null;
  redLightCredits: MemberCredit | null;
  dryCredits: MemberCredit | null;
  ozoneCredits: MemberCredit | null;
  guestPassCredits: MemberCredit | null;
  classPasses: ClassPass[];
}

export function useUserCredits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-credits", user?.id],
    queryFn: async (): Promise<UserCreditsData> => {
      if (!user) {
        console.log("[useUserCredits] No user found");
        return {
          isMember: false,
          membershipType: null,
          memberStatus: null,
          memberId: null,
          classCredits: null,
          redLightCredits: null,
          dryCredits: null,
          ozoneCredits: null,
          guestPassCredits: null,
          classPasses: [],
        };
      }

      console.log("[useUserCredits] Fetching credits for user:", user.id);

      // Check if user is a member (active or frozen — frozen members can still use existing passes)
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("id, membership_type, status")
        .eq("user_id", user.id)
        .in("status", ["active", "frozen"])
        .maybeSingle();

      if (memberError) {
        console.error("[useUserCredits] Error fetching member:", memberError);
      }

      const isMember = !!member;
      const membershipType = member?.membership_type || null;
      const memberStatus = member?.status || null;
      const memberId = member?.id || null;

      console.log("[useUserCredits] Member data:", { isMember, membershipType, memberId });

      // Get active member credits (not expired)
      let classCredits: MemberCredit | null = null;
      let redLightCredits: MemberCredit | null = null;
      let dryCredits: MemberCredit | null = null;
      let guestPassCredits: MemberCredit | null = null;

      const now = new Date().toISOString();

      if (isMember && memberId) {
        // Use member_id instead of user_id for credits query
        // Order by expires_at DESC so newest/current-cycle credits are picked first
        const { data: credits, error: creditsError } = await supabase
          .from("member_credits")
          .select("*")
          .eq("member_id", memberId)
          .gt("expires_at", now)
          .gt("credits_remaining", 0)
          .order("cycle_start", { ascending: false });

        if (creditsError) {
          console.error("[useUserCredits] Error fetching credits:", creditsError);
        }

        console.log("[useUserCredits] Credits query result:", { credits, creditsError, memberId });

        if (credits) {
          // Get the most recent active credit for each type
          for (const credit of credits) {
            const typedCredit = credit as unknown as MemberCredit;
            console.log("[useUserCredits] Processing credit:", typedCredit.credit_type, typedCredit.credits_remaining);
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
              case "guest_pass":
                if (!guestPassCredits) guestPassCredits = typedCredit;
                break;
            }
          }
        }

        console.log("[useUserCredits] Parsed credits:", { classCredits, redLightCredits, dryCredits, guestPassCredits });
      } else if (!isMember) {
        // Non-member: fetch wellness credits by user_id
        const { data: nmCredits, error: nmCreditsError } = await supabase
          .from("member_credits")
          .select("*")
          .eq("user_id", user.id)
          .is("member_id", null)
          .in("credit_type", ["red_light", "dry_cryo"])
          .gt("credits_remaining", 0)
          .gt("expires_at", now)
          .order("expires_at", { ascending: true });

        if (nmCreditsError) {
          console.error("[useUserCredits] Error fetching non-member credits:", nmCreditsError);
        }

        if (nmCredits) {
          for (const credit of nmCredits) {
            const typedCredit = credit as unknown as MemberCredit;
            switch (typedCredit.credit_type) {
              case "red_light":
                if (!redLightCredits) redLightCredits = typedCredit;
                break;
              case "dry_cryo":
                if (!dryCredits) dryCredits = typedCredit;
                break;
            }
          }
        }
        console.log("[useUserCredits] Non-member wellness credits:", { redLightCredits, dryCredits });
      }

      // Get active class passes
      const today = new Date().toISOString();
      const { data: passes, error: passesError } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", today)
        .gt("classes_remaining", 0)
        .order("expires_at");

      if (passesError) {
        console.error("[useUserCredits] Error fetching passes:", passesError);
      }

      return {
        isMember,
        membershipType,
        memberStatus,
        memberId,
        classCredits,
        redLightCredits,
        dryCredits,
        guestPassCredits,
        classPasses: (passes || []) as ClassPass[],
      };
    },
    enabled: !!user,
  });
}

/**
 * Get available credits for a specific class category
 * Uses the category mapping to find all valid passes for the class
 */
export function useAvailableCreditsForCategory(classCategory: string) {
  const { data: creditsData, ...rest } = useUserCredits();

  // Memoize derived values so consumers don't see a fresh object/array
  // on every render (which would re-fire their effects and reset state).
  const data = useMemo(() => {
    const availablePasses = creditsData?.classPasses.filter(
      (pass) =>
        pass.classes_remaining > 0 &&
        !pass.pass_type?.toLowerCase().startsWith("kids_care") &&
        isPassValidForClass(pass.category, classCategory)
    ) || [];

    const hasClassCredits = !!(
      creditsData?.isMember &&
      creditsData?.memberStatus === "active" &&
      creditsData?.classCredits &&
      creditsData.classCredits.credits_remaining > 0
    );

    return {
      hasClassCredits,
      classCreditsRemaining: creditsData?.classCredits?.credits_remaining || 0,
      availablePasses,
      totalPassCredits: availablePasses.reduce((sum, p) => sum + p.classes_remaining, 0),
    };
  }, [creditsData, classCategory]);

  return { data, ...rest };
}
