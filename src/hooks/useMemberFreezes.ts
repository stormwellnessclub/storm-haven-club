import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MemberFreeze {
  id: string;
  member_id: string;
  user_id: string;
  requested_start_date: string;
  requested_end_date: string;
  duration_months: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'cancelled';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  freeze_fee_total: number;
  stripe_payment_intent_id: string | null;
  fee_paid: boolean;
  actual_start_date: string | null;
  actual_end_date: string | null;
  freeze_year: number;
  created_at: string;
  updated_at: string;
}

export function useMemberFreezes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-freezes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("member_freezes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MemberFreeze[];
    },
    enabled: !!user,
  });
}

export function useFreezeEligibility() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ["freeze-eligibility", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return { canFreeze: false, monthsUsed: 0, monthsRemaining: 2, hasPending: false };
      
      // Get all freezes for the current year that are not rejected/cancelled
      const { data, error } = await supabase
        .from("member_freezes")
        .select("duration_months, status")
        .eq("user_id", user.id)
        .eq("freeze_year", currentYear)
        .not("status", "in", '("rejected","cancelled")');

      if (error) throw error;

      const freezes = data || [];
      const hasPending = freezes.some(f => f.status === 'pending' || f.status === 'approved');
      const monthsUsed = freezes
        .filter(f => ['active', 'completed'].includes(f.status))
        .reduce((sum, f) => sum + f.duration_months, 0);
      const monthsRemaining = Math.max(0, 2 - monthsUsed);

      // Count number of freezes used (excluding pending)
      const freezesUsed = freezes.filter(f => ['active', 'completed'].includes(f.status)).length;

      return {
        canFreeze: monthsRemaining > 0 && !hasPending && freezesUsed < 2,
        monthsUsed,
        monthsRemaining,
        hasPending,
        freezesUsed,
      };
    },
    enabled: !!user,
  });
}

interface CreateFreezeRequest {
  memberId: string;
  startDate: Date;
  durationMonths: 1 | 2;
  reason?: string;
}

export function useCreateFreezeRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, startDate, durationMonths, reason }: CreateFreezeRequest) => {
      if (!user) throw new Error("Not authenticated");

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + durationMonths);
      
      const freezeFeeTotal = durationMonths * 20; // $20 per month

      const { data, error } = await supabase
        .from("member_freezes")
        .insert({
          member_id: memberId,
          user_id: user.id,
          requested_start_date: startDate.toISOString().split('T')[0],
          requested_end_date: endDate.toISOString().split('T')[0],
          duration_months: durationMonths,
          reason: reason || null,
          freeze_fee_total: freezeFeeTotal,
          freeze_year: new Date().getFullYear(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-freezes"] });
      queryClient.invalidateQueries({ queryKey: ["freeze-eligibility"] });
      toast.success("Freeze request submitted! You'll be notified once reviewed.");
    },
    onError: (error) => {
      console.error("Error creating freeze request:", error);
      toast.error("Failed to submit freeze request");
    },
  });
}

export function useCancelFreezeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (freezeId: string) => {
      const { error } = await supabase
        .from("member_freezes")
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq("id", freezeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-freezes"] });
      queryClient.invalidateQueries({ queryKey: ["freeze-eligibility"] });
      toast.success("Freeze request cancelled");
    },
    onError: (error) => {
      console.error("Error cancelling freeze request:", error);
      toast.error("Failed to cancel freeze request");
    },
  });
}
