import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  endOfDay,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  extractTier,
  getAnnualPrice,
  getInitiationFee,
  getMonthlyPrice,
  normalizeGender,
  type MembershipTier,
} from "@/lib/membershipPricing";

export type FinancialChargeType =
  | "membership_dues"
  | "annual_fee"
  | "class_pass"
  | "guest_pass"
  | "pos_other";

export type AudienceSegment = "member" | "non_member";

export interface FinancialDateRange {
  start: Date;
  end: Date;
}

export interface FinancialFilters {
  chargeType?: string | boolean;
  tier?: string | boolean;
}

export interface ActiveBillingMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_type: string | null;
  gender: string | null;
  is_founding_member: boolean | null;
  status: string | null;
  next_billing_date: string | null;
  next_annual_fee_date: string | null;
  card_brand: string | null;
  card_last4: string | null;
}

export interface FinancialPaymentAttempt {
  id: string;
  amount: number;
  status: string;
  created_at: string | null;
  failed_at: string | null;
  succeeded_at: string | null;
  resolved_at: string | null;
  superseded_at: string | null;
  attempt_number: number | null;
  decline_code: string | null;
  decline_reason: string | null;
  failure_message: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  member_id: string | null;
  non_member_profile_id: string | null;
  metadata: Record<string, unknown> | null;
  member: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    membership_type: string | null;
    gender: string | null;
    is_founding_member: boolean | null;
  } | null;
  nonMember: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export interface ProjectedCharge {
  key: string;
  memberId: string;
  memberName: string;
  email: string | null;
  tier: MembershipTier;
  chargeType: Extract<FinancialChargeType, "membership_dues" | "annual_fee">;
  amount: number;
  dueDate: string;
  isEstimate: boolean;
  isFoundingMember: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTierLabel(tier: MembershipTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function formatPersonName(person: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name || person.email || "Unknown";
}

export function getAudienceSegment(attempt: FinancialPaymentAttempt): AudienceSegment {
  return attempt.member_id ? "member" : "non_member";
}

export function normalizeChargeType(value: unknown): FinancialChargeType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "membership_dues" ||
    normalized === "annual_fee" ||
    normalized === "class_pass" ||
    normalized === "guest_pass" ||
    normalized === "pos_other"
  ) {
    return normalized;
  }
  if (normalized === "guest_addon" || normalized.startsWith("pos")) {
    return "pos_other";
  }
  return null;
}

export function getAttemptChargeType(attempt: FinancialPaymentAttempt): FinancialChargeType {
  const metadata = (attempt.metadata ?? {}) as Record<string, unknown>;
  const explicit =
    normalizeChargeType(metadata.charge_type) ??
    normalizeChargeType(metadata.type) ??
    normalizeChargeType(metadata.category);

  if (explicit) return explicit;

  const description = String(metadata.description ?? metadata.billing_reason ?? "").toLowerCase();
  if (description.includes("annual")) return "annual_fee";
  if (description.includes("guest")) return "guest_pass";
  if (description.includes("class pass")) return "class_pass";
  if (attempt.stripe_subscription_id) return "membership_dues";
  return attempt.member_id ? "membership_dues" : "pos_other";
}

export function matchesTier(member: { membership_type?: string | null } | null, tierFilter: string | boolean | undefined) {
  if (!tierFilter || tierFilter === "all") return true;
  if (!member?.membership_type) return false;
  return extractTier(member.membership_type) === tierFilter;
}

export function matchesChargeType(chargeType: FinancialChargeType, filterValue: string | boolean | undefined) {
  if (!filterValue || filterValue === "all") return true;
  return chargeType === filterValue;
}

function isWithinRange(dateValue: string | null | undefined, range: FinancialDateRange) {
  if (!dateValue) return false;
  const date = parseISO(dateValue);
  return !isBefore(date, startOfDay(range.start)) && !isAfter(date, endOfDay(range.end));
}

function buildProjectedOccurrences(
  seedDate: string | null,
  intervalMonths: number,
  range: FinancialDateRange,
) {
  if (!seedDate) return [] as Array<{ dueDate: string; isEstimate: boolean }>;

  const seed = startOfDay(parseISO(seedDate));
  const occurrences: Array<{ dueDate: string; isEstimate: boolean }> = [];
  let cursor = seed;
  let step = 0;

  while (!isAfter(cursor, endOfDay(range.end))) {
    if (!isBefore(cursor, startOfDay(range.start))) {
      occurrences.push({
        dueDate: format(cursor, "yyyy-MM-dd"),
        isEstimate: step > 0,
      });
    }
    cursor = addMonths(cursor, intervalMonths);
    step += 1;
  }

  return occurrences;
}

export function buildUpcomingCharges(
  members: ActiveBillingMember[],
  range: FinancialDateRange,
) {
  return members.flatMap<ProjectedCharge>((member) => {
    const tier = extractTier(member.membership_type);
    const gender = normalizeGender(member.gender);
    const memberName = formatPersonName(member);
    const rows: ProjectedCharge[] = [];

    if (isWithinRange(member.next_billing_date, range)) {
      rows.push({
        key: `${member.id}-membership_dues-next`,
        memberId: member.id,
        memberName,
        email: member.email,
        tier,
        chargeType: "membership_dues",
        amount: member.is_founding_member ? getAnnualPrice(tier, gender) : getMonthlyPrice(tier, gender),
        dueDate: member.next_billing_date!,
        isEstimate: false,
        isFoundingMember: !!member.is_founding_member,
        cardBrand: member.card_brand,
        cardLast4: member.card_last4,
      });
    }

    if (isWithinRange(member.next_annual_fee_date, range)) {
      rows.push({
        key: `${member.id}-annual_fee-next`,
        memberId: member.id,
        memberName,
        email: member.email,
        tier,
        chargeType: "annual_fee",
        amount: getInitiationFee(gender),
        dueDate: member.next_annual_fee_date!,
        isEstimate: false,
        isFoundingMember: !!member.is_founding_member,
        cardBrand: member.card_brand,
        cardLast4: member.card_last4,
      });
    }

    return rows;
  });
}

export function buildProjectedCharges(
  members: ActiveBillingMember[],
  range: FinancialDateRange,
) {
  return members.flatMap<ProjectedCharge>((member) => {
    const tier = extractTier(member.membership_type);
    const gender = normalizeGender(member.gender);
    const memberName = formatPersonName(member);
    const duesInterval = member.is_founding_member ? 12 : 1;

    const duesOccurrences = buildProjectedOccurrences(member.next_billing_date, duesInterval, range).map((occurrence) => ({
      key: `${member.id}-membership_dues-${occurrence.dueDate}`,
      memberId: member.id,
      memberName,
      email: member.email,
      tier,
      chargeType: "membership_dues" as const,
      amount: member.is_founding_member ? getAnnualPrice(tier, gender) : getMonthlyPrice(tier, gender),
      dueDate: occurrence.dueDate,
      isEstimate: occurrence.isEstimate,
      isFoundingMember: !!member.is_founding_member,
      cardBrand: member.card_brand,
      cardLast4: member.card_last4,
    }));

    const annualOccurrences = buildProjectedOccurrences(member.next_annual_fee_date, 12, range).map((occurrence) => ({
      key: `${member.id}-annual_fee-${occurrence.dueDate}`,
      memberId: member.id,
      memberName,
      email: member.email,
      tier,
      chargeType: "annual_fee" as const,
      amount: getInitiationFee(gender),
      dueDate: occurrence.dueDate,
      isEstimate: occurrence.isEstimate,
      isFoundingMember: !!member.is_founding_member,
      cardBrand: member.card_brand,
      cardLast4: member.card_last4,
    }));

    return [...duesOccurrences, ...annualOccurrences];
  });
}

export function useFinancialReporting(dateRange: FinancialDateRange) {
  return useQuery({
    queryKey: ["financial-reporting", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const [attemptsResult, membersResult] = await Promise.all([
        supabase
          .from("payment_attempts")
          .select(`
            id,
            amount,
            status,
            created_at,
            failed_at,
            succeeded_at,
            resolved_at,
            superseded_at,
            attempt_number,
            decline_code,
            decline_reason,
            failure_message,
            stripe_invoice_id,
            stripe_payment_intent_id,
            stripe_subscription_id,
            member_id,
            non_member_profile_id,
            metadata,
            members!payment_attempts_member_id_fkey (
              id,
              first_name,
              last_name,
              email,
              membership_type,
              gender,
              is_founding_member
            ),
            non_member_profiles!payment_attempts_non_member_profile_id_fkey (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .gte("created_at", startOfDay(dateRange.start).toISOString())
          .lte("created_at", endOfDay(dateRange.end).toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("members")
          .select(
            "id, first_name, last_name, email, membership_type, gender, is_founding_member, status, next_billing_date, next_annual_fee_date, card_brand, card_last4"
          )
          .eq("status", "active")
          .order("last_name", { ascending: true }),
      ]);

      if (attemptsResult.error) throw attemptsResult.error;
      if (membersResult.error) throw membersResult.error;

      const paymentAttempts: FinancialPaymentAttempt[] = (attemptsResult.data ?? []).map((row: any) => ({
        id: row.id,
        amount: Number(row.amount || 0),
        status: row.status,
        created_at: row.created_at,
        failed_at: row.failed_at,
        succeeded_at: row.succeeded_at,
        resolved_at: row.resolved_at,
        superseded_at: row.superseded_at,
        attempt_number: row.attempt_number,
        decline_code: row.decline_code,
        decline_reason: row.decline_reason,
        failure_message: row.failure_message,
        stripe_invoice_id: row.stripe_invoice_id,
        stripe_payment_intent_id: row.stripe_payment_intent_id,
        stripe_subscription_id: row.stripe_subscription_id,
        member_id: row.member_id,
        non_member_profile_id: row.non_member_profile_id,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        member: row.members
          ? {
              id: row.members.id,
              first_name: row.members.first_name,
              last_name: row.members.last_name,
              email: row.members.email,
              membership_type: row.members.membership_type,
              gender: row.members.gender,
              is_founding_member: row.members.is_founding_member,
            }
          : null,
        nonMember: row.non_member_profiles
          ? {
              id: row.non_member_profiles.id,
              first_name: row.non_member_profiles.first_name,
              last_name: row.non_member_profiles.last_name,
              email: row.non_member_profiles.email,
            }
          : null,
      }));

      return {
        paymentAttempts,
        members: (membersResult.data ?? []) as ActiveBillingMember[],
      };
    },
  });
}