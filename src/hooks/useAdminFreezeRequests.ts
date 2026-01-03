import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MemberFreeze } from "./useMemberFreezes";

export interface FreezeRequestWithMember extends MemberFreeze {
  members: {
    id: string;
    member_id: string;
    first_name: string;
    last_name: string;
    email: string;
    membership_type: string;
    status: string;
  };
}

export function useAdminFreezeRequests(statusFilter?: string) {
  return useQuery({
    queryKey: ["admin-freeze-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("member_freezes")
        .select(`
          *,
          members!inner(id, member_id, first_name, last_name, email, membership_type, status)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as FreezeRequestWithMember[];
    },
  });
}

export function useApproveFreezeRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ freezeId, startDate }: { freezeId: string; startDate: Date }) => {
      if (!user) throw new Error("Not authenticated");

      // Get the freeze request to calculate end date
      const { data: freezeData, error: fetchError } = await supabase
        .from("member_freezes")
        .select("duration_months, member_id")
        .eq("id", freezeId)
        .single();

      if (fetchError) throw fetchError;

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + freezeData.duration_months);

      // Update the freeze request
      const { error: updateError } = await supabase
        .from("member_freezes")
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          actual_start_date: startDate.toISOString().split('T')[0],
          actual_end_date: endDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", freezeId);

      if (updateError) throw updateError;

      return { freezeId, memberId: freezeData.member_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      toast.success("Freeze request approved. Payment link will be sent to member.");
    },
    onError: (error) => {
      console.error("Error approving freeze request:", error);
      toast.error("Failed to approve freeze request");
    },
  });
}

export function useRejectFreezeRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ freezeId, reason }: { freezeId: string; reason: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("member_freezes")
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", freezeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      toast.success("Freeze request rejected");
    },
    onError: (error) => {
      console.error("Error rejecting freeze request:", error);
      toast.error("Failed to reject freeze request");
    },
  });
}

export function useActivateFreeze() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (freezeId: string) => {
      // Get the freeze request
      const { data: freezeData, error: fetchError } = await supabase
        .from("member_freezes")
        .select("member_id")
        .eq("id", freezeId)
        .single();

      if (fetchError) throw fetchError;

      // Update the freeze status to active
      const { error: freezeError } = await supabase
        .from("member_freezes")
        .update({
          status: 'active',
          fee_paid: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", freezeId);

      if (freezeError) throw freezeError;

      // Update the member status to frozen
      const { error: memberError } = await supabase
        .from("members")
        .update({
          status: 'frozen',
          updated_at: new Date().toISOString(),
        })
        .eq("id", freezeData.member_id);

      if (memberError) throw memberError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      toast.success("Freeze activated");
    },
    onError: (error) => {
      console.error("Error activating freeze:", error);
      toast.error("Failed to activate freeze");
    },
  });
}
