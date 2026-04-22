import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractTier, getAnnualPrice, getMonthlyPrice, normalizeGender } from "@/lib/membershipPricing";

export interface NextMemberPaymentData {
  nextDuesDate: string | null;
  nextAnnualFeeDate: string | null;
  nextDuesAmount: number;
  nextAnnualFeeAmount: number;
  cardBrand: string | null;
  cardLast4: string | null;
  openFailedCount: number;
  openFailedAmount: number;
}

export function useNextMemberPayment(memberId: string | undefined) {
  return useQuery({
    queryKey: ["next-member-payment", memberId],
    enabled: !!memberId,
    queryFn: async (): Promise<NextMemberPaymentData | null> => {
      if (!memberId) return null;

      const [{ data: member, error: memberError }, { data: failedRows, error: failedError }] = await Promise.all([
        supabase
          .from("members")
          .select("id, membership_type, gender, is_founding_member, next_billing_date, next_annual_fee_date, card_brand, card_last4")
          .eq("id", memberId)
          .maybeSingle(),
        supabase
          .from("payment_attempts")
          .select("amount")
          .eq("member_id", memberId)
          .eq("status", "failed")
          .is("resolved_at", null)
          .is("superseded_at", null),
      ]);

      if (memberError) throw memberError;
      if (failedError) throw failedError;
      if (!member) return null;

      const tier = extractTier(member.membership_type);
      const gender = normalizeGender(member.gender);

      return {
        nextDuesDate: member.next_billing_date,
        nextAnnualFeeDate: member.next_annual_fee_date,
        nextDuesAmount: member.is_founding_member ? getAnnualPrice(tier, gender) : getMonthlyPrice(tier, gender),
        nextAnnualFeeAmount: gender === "men" ? 175 : 300,
        cardBrand: member.card_brand,
        cardLast4: member.card_last4,
        openFailedCount: failedRows?.length ?? 0,
        openFailedAmount: (failedRows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      };
    },
  });
}