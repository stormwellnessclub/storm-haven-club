import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useReferralData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get member ID
  const { data: member } = useQuery({
    queryKey: ["member-for-referrals", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("members")
        .select("id, first_name, last_name, referral_points_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Get or generate referral code
  const { data: referralCode, isLoading: codeLoading } = useQuery({
    queryKey: ["referral-code", member?.id],
    queryFn: async () => {
      if (!member) return null;
      // Try to get existing code first
      const { data: existing } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("member_id", member.id)
        .maybeSingle();
      if (existing) return existing.code;

      // Generate new code via RPC
      const { data, error } = await supabase.rpc("generate_referral_code", {
        _member_id: member.id,
      });
      if (error) throw error;
      return data as string;
    },
    enabled: !!member?.id,
  });

  // Get referral history
  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["member-referrals", member?.id],
    queryFn: async () => {
      if (!member) return [];
      const { data, error } = await supabase
        .from("member_referrals")
        .select("*")
        .eq("referring_member_id", member.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id,
  });

  // Get point transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["referral-transactions", member?.id],
    queryFn: async () => {
      if (!member) return [];
      const { data, error } = await supabase
        .from("referral_point_transactions")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id,
  });

  // Submit a referral
  const submitReferral = useMutation({
    mutationFn: async (email: string) => {
      if (!member) throw new Error("No member found");
      const trimmedEmail = email.toLowerCase().trim();
      const { error } = await supabase.from("member_referrals").insert({
        referring_member_id: member.id,
        referred_email: trimmedEmail,
      });
      if (error) throw error;

      // Send referral invite email
      if (referralCode) {
        const referralLink = `https://stormwellnessclub.com/apply?ref=${referralCode}`;
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            type: "referral_invite",
            to: trimmedEmail,
            data: {
              referrerName: member.first_name || "A friend",
              referralCode,
              referralLink,
            },
          },
        });
        if (emailError) {
          console.error("Failed to send referral email:", emailError);
          // Don't throw — referral was recorded, email is secondary
        }
      }
    },
    onSuccess: () => {
      toast.success("Referral submitted & invite sent!");
      queryClient.invalidateQueries({ queryKey: ["member-referrals"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Redeem points
  const redeemPoints = useMutation({
    mutationFn: async ({ rewardType, pointsCost }: { rewardType: string; pointsCost: number }) => {
      if (!member) throw new Error("No member found");
      const { data, error } = await supabase.rpc("redeem_referral_points", {
        _member_id: member.id,
        _reward_type: rewardType,
        _points_cost: pointsCost,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; new_balance?: number };
      if (!result.success) throw new Error(result.error || "Redemption failed");
      return result;
    },
    onSuccess: () => {
      toast.success("Reward redeemed successfully!");
      queryClient.invalidateQueries({ queryKey: ["member-for-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["referral-transactions"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const successfulReferrals = referrals.filter((r) => r.status === "active").length;

  return {
    member,
    referralCode,
    codeLoading,
    referrals,
    referralsLoading,
    transactions,
    transactionsLoading,
    submitReferral,
    redeemPoints,
    pointsBalance: member?.referral_points_balance ?? 0,
    successfulReferrals,
  };
}
