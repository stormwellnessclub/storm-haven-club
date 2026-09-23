import { useQuery } from "@tanstack/react-query";
import {
  endOfMonth, endOfQuarter, endOfWeek, endOfYear,
  startOfMonth, startOfQuarter, startOfWeek, startOfYear, subMonths,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ filters */

export type PTDatePreset =
  | "today" | "this_week" | "this_month" | "last_month" | "quarter" | "year" | "custom";

export interface PTFinFilters {
  preset: PTDatePreset;
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
  packId: string;        // "all" | pack uuid
  trainerId: string;     // "all" | instructor uuid | "unattributed"
  clientId: string;      // "all" | user uuid
  paymentStatus: string; // "all" | succeeded | failed | past_due | upcoming | refunded
  paymentMethod: string; // "all" | card | manual | invoice | ...
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Detroit-local calendar presets — the club's operating timezone is the browser's. */
export function presetRange(preset: PTDatePreset, current: { from: string; to: string }) {
  const now = new Date();
  switch (preset) {
    case "today": return { from: iso(now), to: iso(now) };
    case "this_week": return { from: iso(startOfWeek(now, { weekStartsOn: 1 })), to: iso(endOfWeek(now, { weekStartsOn: 1 })) };
    case "this_month": return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    case "last_month": {
      const m = subMonths(now, 1);
      return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) };
    }
    case "quarter": return { from: iso(startOfQuarter(now)), to: iso(endOfQuarter(now)) };
    case "year": return { from: iso(startOfYear(now)), to: iso(endOfYear(now)) };
    default: return current;
  }
}

export const PT_DATE_PRESETS: { value: PTDatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

export const defaultPTFinFilters = (): PTFinFilters => {
  const r = presetRange("this_month", { from: "", to: "" });
  return {
    preset: "this_month",
    from: r.from,
    to: r.to,
    packId: "all",
    trainerId: "all",
    clientId: "all",
    paymentStatus: "all",
    paymentMethod: "all",
  };
};

/* -------------------------------------------------------------------- data */

export interface PTFinancialData {
  passes: any[];
  cash: any[];          // pt_cash_transactions rows in window (collected + refunded)
  installments: any[];  // authoritative schedule — all rows, never recalculated
  appointments: any[];
  invoices: any[];
  clientTrainers: any[];
  dunning: any[];
  packs: any[];
}

/**
 * Loads the authoritative PT financial records. Nothing here is derived from a
 * second ledger: sales come from pt_passes, cash from pt_cash_transactions
 * (pt_payments + pt_refunds), the schedule from pt_payment_plan_installments.
 */
export function usePTFinancialReportData(filters: PTFinFilters) {
  const fromIso = new Date(`${filters.from}T00:00:00`).toISOString();
  const toIso = new Date(`${filters.to}T23:59:59`).toISOString();

  return useQuery({
    queryKey: ["pt-financial-reports", filters.from, filters.to],
    queryFn: async (): Promise<PTFinancialData> => {
      const [passes, cash, installments, appointments, invoices, clientTrainers, dunning, packs] = await Promise.all([
        (supabase as any)
          .from("pt_passes")
          .select("id, user_id, pack_id, pack_name, format, sessions_total, sessions_remaining, price_cents_charged, activated_at, purchased_at, created_at, expires_at, status, amount_paid_cents, amount_outstanding_cents, financial_status, payment_method, payment_plan_subscription_id, payment_plan_status, payment_plan_total_installments, payment_plan_installments_paid, payment_plan_name_snapshot, payment_plan_template_id, plan_total_cents, amount_due_at_sale_cents, future_installment_count, first_autopay_date, final_payment_date, price_override_cents, catalog_price_cents, sold_by_admin_id")
          .limit(5000),
        (supabase as any)
          .from("pt_cash_transactions")
          .select("*")
          .gte("occurred_at", fromIso)
          .lte("occurred_at", toIso)
          .limit(5000),
        (supabase as any)
          .from("pt_payment_plan_installments")
          .select("id, pass_id, user_id, installment_number, due_date, original_due_date, amount_cents, status, paid_at, failed_at, attempt_count, last_failure_reason, stripe_invoice_id, stripe_payment_intent_id, dunning_id, payment_method_brand, payment_method_last4")
          .limit(5000),
        (supabase as any)
          .from("pt_appointments")
          .select("id, user_id, instructor_id, pass_id, starts_at, duration_minutes, status, payment_status, amount_due_cents, paid_at, package_deducted, completed_at")
          .gte("starts_at", fromIso)
          .lte("starts_at", toIso)
          .limit(5000),
        (supabase as any).from("pt_invoices").select("id, user_id, pass_id, invoice_number, status, total_cents, amount_paid_cents, amount_due_cents, issue_date").limit(3000),
        (supabase as any).from("pt_client_trainers").select("id, client_user_id, instructor_id, relationship, assigned_at, ended_at").limit(3000),
        (supabase as any).from("payment_dunning_state").select("id, status, retry_count, amount_cents, created_at").limit(2000),
        (supabase as any).from("pt_packs").select("id, name, sessions, price_cents").limit(500),
      ]);

      // A failed read must never render as a zero in a financial report.
      const failed = [passes, cash, installments, appointments, invoices, clientTrainers, dunning, packs]
        .find((r: any) => r?.error);
      if (failed) throw (failed as any).error;

      return {
        passes: passes.data ?? [],
        cash: cash.data ?? [],
        installments: installments.data ?? [],
        appointments: appointments.data ?? [],
        invoices: invoices.data ?? [],
        clientTrainers: clientTrainers.data ?? [],
        dunning: dunning.data ?? [],
        packs: packs.data ?? [],
      };
    },
  });
}

/* --------------------------------------------------------------- utilities */

export const saleDateOf = (pass: any): string =>
  (pass.purchased_at ?? pass.activated_at ?? pass.created_at ?? "").slice(0, 10);

export const contractValueOf = (pass: any): number =>
  pass.plan_total_cents ?? pass.price_cents_charged ?? 0;

export const isPlanSale = (pass: any): boolean =>
  Boolean(pass.payment_plan_subscription_id || (pass.future_installment_count ?? 0) > 0 || (pass.payment_plan_total_installments ?? 0) > 1);

export const dueAtSaleOf = (pass: any): number =>
  pass.amount_due_at_sale_cents ?? (isPlanSale(pass) ? 0 : contractValueOf(pass));

/**
 * ATTRIBUTION RULE — a package is attributed to a trainer only when the client
 * has an explicit trainer relationship on record (pt_client_trainers). It is
 * never inferred from who delivered the sessions. No relationship = Unattributed.
 */
export function buildAttributionMap(clientTrainers: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  clientTrainers
    .filter((r) => !r.ended_at)
    .sort((a, b) => String(a.assigned_at ?? "").localeCompare(String(b.assigned_at ?? "")))
    .forEach((r) => {
      if (r.client_user_id && r.instructor_id) map[r.client_user_id] = r.instructor_id;
    });
  return map;
}

export const inWindow = (value: string | null | undefined, from: string, to: string) =>
  Boolean(value) && String(value).slice(0, 10) >= from && String(value).slice(0, 10) <= to;
