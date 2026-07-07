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

      // Get the freeze request + member email so we can email them after approval
      const { data: freezeData, error: fetchError } = await supabase
        .from("member_freezes")
        .select(`
          duration_months,
          member_id,
          freeze_fee_total,
          members!inner(email, first_name)
        `)
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

      // Send the freeze payment request email (best-effort — never block approval)
      const member = (freezeData as any).members;
      let emailDelivered = false;
      let emailError: string | null = null;
      if (member?.email) {
        try {
          const { error: emailErr } = await supabase.functions.invoke("send-email", {
            body: {
              type: "freeze_payment_request",
              to: member.email,
              data: {
                firstName: member.first_name ?? "",
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                durationMonths: freezeData.duration_months,
                freezeFeeTotal: freezeData.freeze_fee_total,
              },
            },
          });
          if (emailErr) {
            emailError = emailErr.message;
          } else {
            emailDelivered = true;
          }
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
        }
      } else {
        emailError = "Member has no email on file";
      }

      return { freezeId, memberId: freezeData.member_id, emailDelivered, emailError };
    },
    onSuccess: ({ emailDelivered, emailError }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      if (emailDelivered) {
        toast.success("Freeze approved — payment email sent to member");
      } else {
        toast.warning(`Freeze approved — payment email NOT sent${emailError ? `: ${emailError}` : ""}. Use "Resend payment email" to retry.`);
      }
    },
    onError: (error) => {
      console.error("Error approving freeze request:", error);
      toast.error("Failed to approve freeze request");
    },
  });
}

export function useResendFreezePaymentEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (freezeId: string) => {
      const { data: freezeData, error: fetchError } = await supabase
        .from("member_freezes")
        .select(`
          duration_months,
          freeze_fee_total,
          actual_start_date,
          actual_end_date,
          requested_start_date,
          requested_end_date,
          members!inner(email, first_name)
        `)
        .eq("id", freezeId)
        .single();

      if (fetchError) throw fetchError;
      const member = (freezeData as any).members;
      if (!member?.email) throw new Error("Member has no email on file");

      const { error: emailErr } = await supabase.functions.invoke("send-email", {
        body: {
          type: "freeze_payment_request",
          to: member.email,
          data: {
            firstName: member.first_name ?? "",
            startDate: freezeData.actual_start_date ?? freezeData.requested_start_date,
            endDate: freezeData.actual_end_date ?? freezeData.requested_end_date,
            durationMonths: freezeData.duration_months,
            freezeFeeTotal: freezeData.freeze_fee_total,
          },
        },
      });
      if (emailErr) throw new Error(emailErr.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      toast.success("Payment email sent to member");
    },
    onError: (error) => {
      console.error("Error resending freeze payment email:", error);
      toast.error(`Failed to send payment email: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

interface RejectFreezeArgs {
  freezeId: string;
  /** Internal audit-only reason stored on the freeze record. Not sent to the member. */
  reason: string;
  /** When true, send a branded rejection email to the member with the edited subject + body. */
  sendEmail: boolean;
  emailSubject?: string;
  emailBody?: string;
  recipientEmail?: string;
  recipientFirstName?: string;
}

export function useRejectFreezeRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      freezeId,
      reason,
      sendEmail,
      emailSubject,
      emailBody,
      recipientEmail,
      recipientFirstName,
    }: RejectFreezeArgs) => {
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

      // Email send is best-effort — never block the rejection itself.
      let emailDelivered = false;
      let emailError: string | null = null;
      if (sendEmail && recipientEmail && emailBody?.trim()) {
        try {
          const { error: emailErr } = await supabase.functions.invoke("send-email", {
            body: {
              type: "freeze_request_rejected",
              to: recipientEmail,
              data: {
                subject: emailSubject?.trim() || "Regarding Your Freeze Request",
                bodyText: emailBody.trim(),
                memberFirstName: recipientFirstName ?? "",
              },
            },
          });
          if (emailErr) {
            emailError = emailErr.message;
          } else {
            emailDelivered = true;
          }
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
        }
      }

      return { emailRequested: sendEmail, emailDelivered, emailError };
    },
    onSuccess: ({ emailRequested, emailDelivered, emailError }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      if (emailRequested) {
        if (emailDelivered) {
          toast.success("Freeze rejected — email sent to member");
        } else {
          toast.warning(`Freeze rejected — email failed to send${emailError ? `: ${emailError}` : ""}`);
        }
      } else {
        toast.success("Freeze request rejected");
      }
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
    mutationFn: async ({ freezeId, waiveFee = false }: { freezeId: string; waiveFee?: boolean }) => {
      // Get the freeze request and member data
      const { data: freezeData, error: fetchError } = await supabase
        .from("member_freezes")
        .select("member_id")
        .eq("id", freezeId)
        .single();

      if (fetchError) throw fetchError;

      // Get member's subscription ID for pausing
      const { data: memberData, error: memberFetchError } = await supabase
        .from("members")
        .select("stripe_subscription_id, annual_fee_subscription_id")
        .eq("id", freezeData.member_id)
        .single();

      if (memberFetchError) throw memberFetchError;

      // Update the freeze status to active
      const { error: freezeError } = await supabase
        .from("member_freezes")
        .update({
          status: 'active',
          fee_paid: true,
          updated_at: new Date().toISOString(),
          ...(waiveFee ? { freeze_fee_total: 0 } : {}),
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

      // Pause membership dues subscription if it exists.
      // Annual/initiation fee subscription is intentionally NOT paused during a freeze —
      // it continues billing on its normal yearly cadence.
      if (memberData?.stripe_subscription_id) {
        try {
          // Tell Stripe when to resume so the dashboard shows a resume date.
          // Our process-freeze-expirations cron remains the authoritative trigger.
          const resumesAt = freezeData.actual_end_date
            ? new Date(`${freezeData.actual_end_date}T23:59:59Z`).toISOString()
            : undefined;

          const { error: pauseError } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "pause_subscription",
              subscriptionId: memberData.stripe_subscription_id,
              resumesAt,
            },
          });

          if (pauseError) {
            console.error("Failed to pause membership subscription:", pauseError);
          }
        } catch (pauseErr) {
          console.error("Error pausing membership subscription:", pauseErr);
        }
      }
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

export function useEndFreezeEarly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (freezeId: string) => {
      // Get the freeze request and member data
      const { data: freezeData, error: fetchError } = await supabase
        .from("member_freezes")
        .select("member_id")
        .eq("id", freezeId)
        .single();

      if (fetchError) throw fetchError;

      // Get member's subscription IDs for resuming
      const { data: memberData, error: memberFetchError } = await supabase
        .from("members")
        .select("stripe_subscription_id, annual_fee_subscription_id")
        .eq("id", freezeData.member_id)
        .single();

      if (memberFetchError) throw memberFetchError;

      // Mark freeze as completed with today's date
      const { error: freezeError } = await supabase
        .from("member_freezes")
        .update({
          status: 'completed',
          actual_end_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", freezeId);

      if (freezeError) throw freezeError;

      // Set member status back to active
      const { error: memberError } = await supabase
        .from("members")
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq("id", freezeData.member_id);

      if (memberError) throw memberError;

      // Resume membership subscription and realign billing anchor
      if (memberData?.stripe_subscription_id) {
        try {
          const { error: resumeError } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "resume_subscription",
              subscriptionId: memberData.stripe_subscription_id,
            },
          });

          if (resumeError) {
            console.error("Failed to resume membership subscription:", resumeError);
          } else {
            // Realign billing cycle to today (freeze end date)
            const today = new Date();
            today.setHours(23, 59, 59, 0);
            const { error: anchorError } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "update_billing_anchor",
                subscriptionId: memberData.stripe_subscription_id,
                newAnchorDate: today.toISOString(),
              },
            });
            if (anchorError) {
              console.error("Failed to realign membership billing anchor:", anchorError);
            }
          }
        } catch (resumeErr) {
          console.error("Error resuming membership subscription:", resumeErr);
        }
      }

      // Resume annual fee subscription and realign billing anchor
      if (memberData?.annual_fee_subscription_id) {
        try {
          const { error: resumeError } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "resume_subscription",
              subscriptionId: memberData.annual_fee_subscription_id,
            },
          });

          if (resumeError) {
            console.error("Failed to resume annual fee subscription:", resumeError);
          } else {
            // Realign billing cycle to today (freeze end date)
            const today = new Date();
            today.setHours(23, 59, 59, 0);
            const { error: anchorError } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "update_billing_anchor",
                subscriptionId: memberData.annual_fee_subscription_id,
                newAnchorDate: today.toISOString(),
              },
            });
            if (anchorError) {
              console.error("Failed to realign annual fee billing anchor:", anchorError);
            }
          }
        } catch (resumeErr) {
          console.error("Error resuming annual fee subscription:", resumeErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-freeze-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      toast.success("Freeze ended early — member reactivated and billing resumed");
    },
    onError: (error) => {
      console.error("Error ending freeze early:", error);
      toast.error("Failed to end freeze early");
    },
  });
}
