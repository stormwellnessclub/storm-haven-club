import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import { extractTier, normalizeGender, getMonthlyPrice } from "@/lib/membershipPricing";
import type { DateRange } from "@/components/admin/DateRangePicker";

export interface AutopayEntry {
  id: string;
  date: string;
  member_id: string | null;
  member_name: string;
  member_email: string;
  payment_type: string; // "Monthly Dues", "Annual Initiation Fee", "Manual Charge"
  tier: string;
  card_info: string | null;
  amount: number;
  status: "success" | "failed" | "upcoming";
  decline_reason: string | null;
  is_founding_member: boolean;
}

export interface AutopaySummary {
  totalUpcoming: number;
  totalUpcomingAmount: number;
  totalCollected: number;
  totalFailed: number;
  successRate: number;
}

function detectPaymentType(amount: number, member: any): string {
  // Annual fee amounts: $300 (women) or $175 (men)
  if (amount === 300 || amount === 175 || amount === 30000 || amount === 17500) {
    return "Annual Initiation Fee";
  }
  
  const tier = extractTier(member?.membership_type);
  const gender = normalizeGender(member?.gender);
  const monthlyPrice = getMonthlyPrice(tier, gender);
  
  // Check if amount matches monthly dues (could be in cents or dollars)
  if (monthlyPrice && (amount === monthlyPrice || amount === monthlyPrice * 100)) {
    return `Monthly Dues`;
  }
  
  return "Monthly Dues";
}

function formatCardInfo(brand: string | null, last4: string | null): string | null {
  if (!brand && !last4) return null;
  const b = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "";
  return `${b} •••• ${last4 || "????"}`;
}

export function useAutopaySchedule(
  dateRange: DateRange,
  filters?: {
    status?: string;
    paymentType?: string;
    search?: string;
  }
) {
  return useQuery({
    queryKey: ["autopay-schedule", dateRange, filters],
    queryFn: async (): Promise<{ entries: AutopayEntry[]; summary: AutopaySummary }> => {
      const entries: AutopayEntry[] = [];

      // 1. Fetch historical payment attempts with member info
      let paQuery = supabase
        .from("payment_attempts")
        .select(`
          id, amount, status, created_at, decline_code, decline_reason, failure_message,
          member_id,
          members!inner(first_name, last_name, email, membership_type, gender, 
            card_brand, card_last4, card_exp_month, card_exp_year, is_founding_member)
        `)
        .order("created_at", { ascending: false });

      if (dateRange.from) {
        paQuery = paQuery.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        paQuery = paQuery.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data: paymentAttempts } = await paQuery;

      for (const pa of paymentAttempts || []) {
        const member = pa.members as any;
        const amountDollars = pa.amount >= 100 ? pa.amount / 100 : pa.amount;
        
        entries.push({
          id: pa.id,
          date: pa.created_at || "",
          member_id: pa.member_id,
          member_name: `${member?.first_name || ""} ${member?.last_name || ""}`.trim(),
          member_email: member?.email || "",
          payment_type: detectPaymentType(pa.amount, member),
          tier: extractTier(member?.membership_type),
          card_info: formatCardInfo(member?.card_brand, member?.card_last4),
          amount: amountDollars,
          status: pa.status === "succeeded" ? "success" : "failed",
          decline_reason: pa.decline_reason || pa.failure_message || null,
          is_founding_member: member?.is_founding_member || false,
        });
      }

      // 2. Fetch upcoming autopays from active members
      const { data: activeMembers } = await supabase
        .from("members")
        .select(`
          id, first_name, last_name, email, membership_type, gender,
          card_brand, card_last4, card_exp_month, card_exp_year,
          is_founding_member, stripe_subscription_id, subscription_status,
          membership_start_date, billing_type, annual_fee_subscription_id
        `)
        .eq("status", "active")
        .not("stripe_subscription_id", "is", null);

      const now = new Date();
      for (const m of activeMembers || []) {
        if (m.is_founding_member) continue; // founding members have no monthly autopay
        
        const tier = extractTier(m.membership_type);
        const gender = normalizeGender(m.gender);
        const monthlyPrice = getMonthlyPrice(tier, gender);
        
        if (!monthlyPrice) continue;

        // Calculate next billing date from membership_start_date
        const startDate = new Date(m.membership_start_date);
        let nextBilling = new Date(startDate);
        while (isBefore(nextBilling, now)) {
          nextBilling = addMonths(nextBilling, 1);
        }

        // Only include if within date range
        const inRange = (!dateRange.from || !isBefore(nextBilling, startOfDay(dateRange.from))) &&
                        (!dateRange.to || !isAfter(nextBilling, endOfDay(dateRange.to)));
        
        if (inRange) {
          entries.push({
            id: `upcoming-${m.id}-dues`,
            date: nextBilling.toISOString(),
            member_id: m.id,
            member_name: `${m.first_name} ${m.last_name}`,
            member_email: m.email,
            payment_type: "Monthly Dues",
            tier,
            card_info: formatCardInfo(m.card_brand, m.card_last4),
            amount: monthlyPrice,
            status: "upcoming",
            decline_reason: null,
            is_founding_member: false,
          });
        }

        // Annual fee upcoming (if they have an annual fee subscription)
        if (m.annual_fee_subscription_id) {
          const annualFee = gender === "men" ? 175 : 300;
          // Annual fee renews yearly from start date
          let nextAnnual = new Date(startDate);
          while (isBefore(nextAnnual, now)) {
            nextAnnual = addMonths(nextAnnual, 12);
          }
          const annualInRange = (!dateRange.from || !isBefore(nextAnnual, startOfDay(dateRange.from))) &&
                                (!dateRange.to || !isAfter(nextAnnual, endOfDay(dateRange.to)));
          if (annualInRange) {
            entries.push({
              id: `upcoming-${m.id}-annual`,
              date: nextAnnual.toISOString(),
              member_id: m.id,
              member_name: `${m.first_name} ${m.last_name}`,
              member_email: m.email,
              payment_type: "Annual Initiation Fee",
              tier,
              card_info: formatCardInfo(m.card_brand, m.card_last4),
              amount: annualFee,
              status: "upcoming",
              decline_reason: null,
              is_founding_member: false,
            });
          }
        }
      }

      // Sort by date descending (upcoming first, then recent)
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Apply filters
      let filtered = entries;
      if (filters?.status && filters.status !== "all") {
        filtered = filtered.filter(e => e.status === filters.status);
      }
      if (filters?.paymentType && filters.paymentType !== "all") {
        filtered = filtered.filter(e => e.payment_type === filters.paymentType);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(e =>
          e.member_name.toLowerCase().includes(s) ||
          e.member_email.toLowerCase().includes(s)
        );
      }

      // Calculate summary
      const upcoming = filtered.filter(e => e.status === "upcoming");
      const succeeded = filtered.filter(e => e.status === "success");
      const failed = filtered.filter(e => e.status === "failed");
      const total = succeeded.length + failed.length;

      const summary: AutopaySummary = {
        totalUpcoming: upcoming.length,
        totalUpcomingAmount: upcoming.reduce((sum, e) => sum + e.amount, 0),
        totalCollected: succeeded.reduce((sum, e) => sum + e.amount, 0),
        totalFailed: failed.length,
        successRate: total > 0 ? Math.round((succeeded.length / total) * 100) : 100,
      };

      return { entries: filtered, summary };
    },
  });
}
