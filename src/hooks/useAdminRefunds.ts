import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface RefundRequest {
  id: string;
  member_id: string | null;
  original_charge_id: string | null;
  original_payment_intent_id: string | null;
  charge_type: string;
  refund_type: string;
  amount_cents: number;
  currency: string;
  reason: string | null;
  status: string;
  requested_by: string | null;
  manager_code: string | null;
  approved_by: string | null;
  stripe_refund_id: string | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

interface AdminActionLog {
  id: string;
  member_id: string | null;
  action_type: string;
  action_data: Record<string, unknown>;
  performed_by: string | null;
  can_undo: boolean;
  undo_expires_at: string | null;
  undone_at: string | null;
  undone_by: string | null;
  created_at: string;
}

interface ProcessRefundParams {
  memberId: string;
  chargeId?: string;
  paymentIntentId?: string;
  chargeType: string;
  amountCents: number;
  reason?: string;
  managerCode?: string;
  refundMethod: 'stripe' | 'check' | 'other';
}

interface UndoActionParams {
  actionLogId: string;
  includeRefund?: boolean;
  managerCode?: string;
}

// Hook to fetch refund history for a member
export function useMemberRefunds(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-refunds", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as RefundRequest[];
    },
    enabled: !!memberId,
  });
}

// Hook to fetch undoable actions for a member
export function useMemberUndoableActions(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-undoable-actions", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      
      const { data, error } = await supabase
        .from("admin_action_log")
        .select("*")
        .eq("member_id", memberId)
        .eq("can_undo", true)
        .is("undone_at", null)
        .gt("undo_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as AdminActionLog[];
    },
    enabled: !!memberId,
  });
}

// Hook to get the most recent undoable action
export function useLastUndoableAction(memberId: string | undefined) {
  const { data: actions = [] } = useMemberUndoableActions(memberId);
  return actions.length > 0 ? actions[0] : null;
}

// Hook to process a refund
export function useProcessRefund() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: ProcessRefundParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired");

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "process_admin_refund",
          memberId: params.memberId,
          chargeId: params.chargeId,
          paymentIntentId: params.paymentIntentId,
          chargeType: params.chargeType,
          refundAmount: params.amountCents,
          refundNotes: params.reason,
          managerCode: params.managerCode,
          refundMethodType: params.refundMethod,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["member-refunds", variables.memberId] });
      queryClient.invalidateQueries({ queryKey: ["charge-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", variables.memberId] });
      toast.success("Refund processed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to process refund");
    },
  });
}

// Hook to log an admin action (for undo support)
export function useLogAdminAction() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (params: {
      memberId: string;
      actionType: string;
      actionData: Record<string, unknown>;
      canUndo?: boolean;
      undoExpiresInHours?: number;
    }) => {
      const undoExpiresAt = params.canUndo !== false
        ? new Date(Date.now() + (params.undoExpiresInHours || 24) * 60 * 60 * 1000).toISOString()
        : null;

      const insertData = {
        member_id: params.memberId,
        action_type: params.actionType,
        action_data: params.actionData,
        performed_by: user?.id,
        can_undo: params.canUndo !== false,
        undo_expires_at: undoExpiresAt,
      };

      const { data, error } = await supabase
        .from("admin_action_log")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// Hook to undo an admin action
export function useUndoAdminAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: UndoActionParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired");

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "undo_admin_action",
          actionLogId: params.actionLogId,
          includeRefund: params.includeRefund,
          managerCode: params.managerCode,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      // Invalidate all related queries
      if (data?.memberId) {
        queryClient.invalidateQueries({ queryKey: ["admin-member-detail", data.memberId] });
        queryClient.invalidateQueries({ queryKey: ["member-credits", data.memberId] });
        queryClient.invalidateQueries({ queryKey: ["member-undoable-actions", data.memberId] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      toast.success("Action undone successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to undo action");
    },
  });
}

// Hook to validate manager code
export function useValidateManagerCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, manager_refund_code")
        .eq("manager_refund_code", code)
        .single();

      if (error || !data) {
        throw new Error("Invalid manager code");
      }

      return {
        userId: data.user_id,
        name: `${data.first_name} ${data.last_name}`,
      };
    },
  });
}
