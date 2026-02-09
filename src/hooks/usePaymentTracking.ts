import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "@/components/admin/DateRangePicker";

export interface FailedPayment {
  id: string;
  member_id: string | null;
  member_name: string;
  member_email: string;
  membership_type: string;
  amount: number;
  currency: string;
  status: string;
  decline_code: string | null;
  decline_reason: string | null;
  failure_message: string | null;
  failure_code: string | null;
  attempt_number: number | null;
  next_retry_at: string | null;
  created_at: string;
  failed_at: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  email_sent: boolean;
}

export interface UpcomingPayment {
  member_id: string;
  member_name: string;
  member_email: string;
  membership_type: string;
  expected_amount: number;
  next_billing_date: Date;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_founding_member: boolean;
  risk_level: "high" | "medium" | "low";
}

export interface SuccessfulPayment {
  id: string;
  source: "manual_charge" | "payment_attempt";
  member_id: string | null;
  member_name: string;
  member_email: string;
  description: string;
  amount: number;
  payment_method: string;
  date: string;
  receipt_sent: boolean;
  stripe_id: string | null;
}

export interface PaymentEmail {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  email_type: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  member_id: string | null;
  application_id: string | null;
  template_data: any;
}

export function useFailedPayments(dateRange: DateRange, filters?: {
  declineCode?: string;
  status?: string;
  tier?: string;
  emailSent?: boolean | null;
}) {
  return useQuery({
    queryKey: ["failed-payments", dateRange, filters],
    queryFn: async () => {
      let query = supabase
        .from("payment_attempts")
        .select(`
          id,
          member_id,
          amount,
          currency,
          status,
          decline_code,
          decline_reason,
          failure_message,
          failure_code,
          attempt_number,
          next_retry_at,
          created_at,
          failed_at,
          invoice_id,
          invoice_number,
          members!inner (
            first_name,
            last_name,
            email,
            membership_type
          )
        `)
        .in("status", ["failed", "requires_action", "pending"])
        .order("created_at", { ascending: false });

      if (dateRange.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }
      if (filters?.declineCode) {
        query = query.eq("decline_code", filters.declineCode);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.tier) {
        query = query.eq("members.membership_type", filters.tier);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Check email audit log for payment_failed emails
      const memberIds = [...new Set(data?.map(d => d.member_id).filter(Boolean))];
      let emailsSent: Record<string, boolean> = {};
      
      if (memberIds.length > 0) {
        const { data: emailData } = await supabase
          .from("email_audit_log")
          .select("member_id")
          .eq("email_type", "payment_failed")
          .in("member_id", memberIds);
        
        emailsSent = (emailData || []).reduce((acc, e) => {
          if (e.member_id) acc[e.member_id] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      const result: FailedPayment[] = (data || []).map((pa: any) => ({
        id: pa.id,
        member_id: pa.member_id,
        member_name: `${pa.members.first_name} ${pa.members.last_name}`,
        member_email: pa.members.email,
        membership_type: pa.members.membership_type,
        amount: pa.amount,
        currency: pa.currency || "usd",
        status: pa.status,
        decline_code: pa.decline_code,
        decline_reason: pa.decline_reason,
        failure_message: pa.failure_message,
        failure_code: pa.failure_code,
        attempt_number: pa.attempt_number,
        next_retry_at: pa.next_retry_at,
        created_at: pa.created_at,
        failed_at: pa.failed_at,
        invoice_id: pa.invoice_id,
        invoice_number: pa.invoice_number,
        email_sent: pa.member_id ? !!emailsSent[pa.member_id] : false,
      }));

      if (filters?.emailSent !== null && filters?.emailSent !== undefined) {
        return result.filter(r => r.email_sent === filters.emailSent);
      }

      return result;
    },
  });
}

export function useUpcomingPayments(daysAhead: number = 30, filters?: {
  tier?: string;
  cardStatus?: "expiring" | "expired" | "valid";
  foundingMemberOnly?: boolean;
}) {
  return useQuery({
    queryKey: ["upcoming-payments", daysAhead, filters],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("*")
        .not("stripe_subscription_id", "is", null)
        .eq("status", "active");

      if (filters?.tier) {
        query = query.eq("membership_type", filters.tier);
      }
      if (filters?.foundingMemberOnly) {
        query = query.eq("is_founding_member", true);
      }

      const { data, error } = await query;
      if (error) throw error;

      const now = new Date();
      const result: UpcomingPayment[] = [];

      for (const member of data || []) {
        // Calculate next billing date based on membership_start_date
        const startDate = new Date(member.membership_start_date);
        let nextBilling = new Date(startDate);
        
        while (isBefore(nextBilling, now)) {
          nextBilling = addMonths(nextBilling, 1);
        }

        // Calculate expected amount based on tier
        const tierPricing: Record<string, number> = {
          soul: 300,
          spirit: 450,
          aura: 750,
        };
        const expectedAmount = tierPricing[member.membership_type.toLowerCase()] || 0;

        // Determine risk level
        let riskLevel: "high" | "medium" | "low" = "low";
        if (member.card_exp_year && member.card_exp_month) {
          const cardExpiry = new Date(member.card_exp_year, member.card_exp_month - 1);
          if (isBefore(cardExpiry, now)) {
            riskLevel = "high";
          } else if (isBefore(cardExpiry, nextBilling)) {
            riskLevel = "high";
          } else if (isBefore(cardExpiry, addMonths(nextBilling, 1))) {
            riskLevel = "medium";
          }
        } else if (!member.card_last4) {
          riskLevel = "high";
        }

        // Apply card status filter
        if (filters?.cardStatus) {
          if (filters.cardStatus === "expired" && riskLevel !== "high") continue;
          if (filters.cardStatus === "expiring" && riskLevel !== "medium") continue;
          if (filters.cardStatus === "valid" && riskLevel !== "low") continue;
        }

        // Check if within date range
        const daysUntil = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil > daysAhead) continue;

        result.push({
          member_id: member.id,
          member_name: `${member.first_name} ${member.last_name}`,
          member_email: member.email,
          membership_type: member.membership_type,
          expected_amount: expectedAmount,
          next_billing_date: nextBilling,
          card_brand: member.card_brand,
          card_last4: member.card_last4,
          card_exp_month: member.card_exp_month,
          card_exp_year: member.card_exp_year,
          is_founding_member: member.is_founding_member || false,
          risk_level: riskLevel,
        });
      }

      return result.sort((a, b) => a.next_billing_date.getTime() - b.next_billing_date.getTime());
    },
  });
}

export function useSuccessfulPayments(dateRange: DateRange, filters?: {
  paymentType?: string;
  tier?: string;
  foundingMemberOnly?: boolean;
}) {
  return useQuery({
    queryKey: ["successful-payments", dateRange, filters],
    queryFn: async () => {
      const results: SuccessfulPayment[] = [];

      // Fetch manual charges
      let manualQuery = supabase
        .from("manual_charges")
        .select(`
          id,
          member_id,
          amount,
          description,
          created_at,
          stripe_payment_intent_id,
          members (
            first_name,
            last_name,
            email,
            membership_type,
            card_brand,
            card_last4,
            is_founding_member
          )
        `)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false });

      if (dateRange.from) {
        manualQuery = manualQuery.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        manualQuery = manualQuery.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: manualData } = await manualQuery;

      // Fetch successful payment attempts
      let paQuery = supabase
        .from("payment_attempts")
        .select(`
          id,
          member_id,
          amount,
          succeeded_at,
          invoice_number,
          members (
            first_name,
            last_name,
            email,
            membership_type,
            card_brand,
            card_last4,
            is_founding_member
          )
        `)
        .eq("status", "succeeded")
        .order("succeeded_at", { ascending: false });

      if (dateRange.from) {
        paQuery = paQuery.gte("succeeded_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        paQuery = paQuery.lte("succeeded_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: paData } = await paQuery;

      // Check email audit log for receipts
      const memberIds = [
        ...(manualData || []).map(d => d.member_id),
        ...(paData || []).map(d => d.member_id),
      ].filter(Boolean);

      let receiptsSent: Record<string, boolean> = {};
      if (memberIds.length > 0) {
        const { data: emailData } = await supabase
          .from("email_audit_log")
          .select("member_id")
          .eq("email_type", "charge_confirmation")
          .in("member_id", memberIds);
        
        receiptsSent = (emailData || []).reduce((acc, e) => {
          if (e.member_id) acc[e.member_id] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      // Process manual charges
      for (const mc of manualData || []) {
        const member = mc.members as any;
        if (!member) continue;

        if (filters?.tier && member.membership_type !== filters.tier) continue;
        if (filters?.foundingMemberOnly && !member.is_founding_member) continue;
        if (filters?.paymentType && filters.paymentType !== "Manual Charge") continue;

        results.push({
          id: mc.id,
          source: "manual_charge",
          member_id: mc.member_id,
          member_name: `${member.first_name} ${member.last_name}`,
          member_email: member.email,
          description: mc.description,
          amount: mc.amount,
          payment_method: member.card_brand && member.card_last4 
            ? `${member.card_brand} •••• ${member.card_last4}`
            : "Card",
          date: mc.created_at,
          receipt_sent: mc.member_id ? !!receiptsSent[mc.member_id] : false,
          stripe_id: mc.stripe_payment_intent_id,
        });
      }

      // Process payment attempts
      for (const pa of paData || []) {
        const member = pa.members as any;
        if (!member) continue;

        if (filters?.tier && member.membership_type !== filters.tier) continue;
        if (filters?.foundingMemberOnly && !member.is_founding_member) continue;
        if (filters?.paymentType && filters.paymentType !== "Subscription") continue;

        results.push({
          id: pa.id,
          source: "payment_attempt",
          member_id: pa.member_id,
          member_name: `${member.first_name} ${member.last_name}`,
          member_email: member.email,
          description: pa.invoice_number ? `Invoice ${pa.invoice_number}` : "Subscription Payment",
          amount: pa.amount,
          payment_method: member.card_brand && member.card_last4 
            ? `${member.card_brand} •••• ${member.card_last4}`
            : "Card",
          date: pa.succeeded_at || "",
          receipt_sent: pa.member_id ? !!receiptsSent[pa.member_id] : false,
          stripe_id: null,
        });
      }

      return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });
}

export function usePaymentEmails(dateRange: DateRange, filters?: {
  emailType?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["payment-emails", dateRange, filters],
    queryFn: async () => {
      const paymentEmailTypes = [
        "payment_failed",
        "charge_confirmation",
        "admin_payment_failed_alert",
        "annual_fee_payment_request",
        "add_card_for_dues",
      ];

      let query = supabase
        .from("email_audit_log")
        .select("*")
        .in("email_type", paymentEmailTypes)
        .order("created_at", { ascending: false });

      if (dateRange.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }
      if (filters?.emailType) {
        query = query.eq("email_type", filters.emailType);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.search) {
        query = query.or(`recipient_email.ilike.%${filters.search}%,recipient_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as PaymentEmail[];
    },
  });
}

export function usePaymentStats(dateRange: DateRange) {
  return useQuery({
    queryKey: ["payment-stats", dateRange],
    queryFn: async () => {
      // Failed payments stats
      let failedQuery = supabase
        .from("payment_attempts")
        .select("id, amount, member_id, decline_code")
        .in("status", ["failed", "requires_action"]);

      if (dateRange.from) {
        failedQuery = failedQuery.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        failedQuery = failedQuery.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: failedData } = await failedQuery;

      const totalFailedAttempts = failedData?.length || 0;
      const totalFailedAmount = failedData?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const uniqueMembersAffected = new Set(failedData?.map(p => p.member_id).filter(Boolean)).size;
      const avgAttemptsPerMember = uniqueMembersAffected > 0 ? totalFailedAttempts / uniqueMembersAffected : 0;
      
      // Most common decline reason
      const declineCounts = (failedData || []).reduce((acc, p) => {
        if (p.decline_code) {
          acc[p.decline_code] = (acc[p.decline_code] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      const mostCommonDecline = Object.entries(declineCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      // Successful payments stats
      let successQuery = supabase
        .from("payment_attempts")
        .select("id, amount")
        .eq("status", "succeeded");

      if (dateRange.from) {
        successQuery = successQuery.gte("succeeded_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        successQuery = successQuery.lte("succeeded_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: successData } = await successQuery;

      let manualSuccessQuery = supabase
        .from("manual_charges")
        .select("id, amount")
        .eq("status", "succeeded");

      if (dateRange.from) {
        manualSuccessQuery = manualSuccessQuery.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        manualSuccessQuery = manualSuccessQuery.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: manualSuccessData } = await manualSuccessQuery;

      const totalCollected = 
        (successData?.reduce((sum, p) => sum + p.amount, 0) || 0) +
        (manualSuccessData?.reduce((sum, p) => sum + p.amount, 0) || 0);
      const transactionCount = (successData?.length || 0) + (manualSuccessData?.length || 0);
      const averageTransaction = transactionCount > 0 ? totalCollected / transactionCount : 0;

      return {
        failed: {
          totalAttempts: totalFailedAttempts,
          totalAmount: totalFailedAmount,
          uniqueMembers: uniqueMembersAffected,
          avgAttempts: avgAttemptsPerMember,
          mostCommonDecline,
        },
        success: {
          totalCollected,
          transactionCount,
          averageTransaction,
        },
      };
    },
  });
}
