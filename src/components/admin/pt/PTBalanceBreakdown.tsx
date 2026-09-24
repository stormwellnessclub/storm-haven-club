import { usePTOutstanding } from "@/hooks/pt/usePTBillingCenter";
import { formatCents } from "@/lib/ptFormat";

/**
 * The one PT amount-owed breakdown. Every admin screen (PT client profile,
 * PT client billing, main member/non-member profile) renders this so the
 * definitions are identical — all numbers come from pt_outstanding_balance().
 */
export const PT_BALANCE_DEFINITIONS = {
  past_due: "Failed / past-due autopay installments plus past-due invoices.",
  unpaid: "Completed sessions with no package or payment, not yet invoiced.",
  future: "Stored autopay installments still scheduled to charge.",
  total: "Everything still owed: open invoices, unpaid sessions, package balances and remaining plan installments (past due + future).",
};

export function PTBalanceBreakdown({ userId, variant = "pt" }: { userId?: string; variant?: "pt" | "admin" }) {
  const { data: o } = usePTOutstanding(userId);
  const items = [
    { label: "Past due", value: o?.past_due_cents ?? 0, tip: PT_BALANCE_DEFINITIONS.past_due, alert: true },
    { label: "Unpaid completed sessions", value: o?.unpaid_completed_sessions_cents ?? 0, tip: PT_BALANCE_DEFINITIONS.unpaid, alert: true },
    { label: "Future scheduled autopay", value: o?.future_scheduled_autopay_cents ?? 0, tip: PT_BALANCE_DEFINITIONS.future },
    { label: "Total remaining contract balance", value: o?.total_remaining_contract_balance_cents ?? o?.total_outstanding_cents ?? 0, tip: PT_BALANCE_DEFINITIONS.total },
  ];
  const box = variant === "pt" ? "rounded-lg border border-pt-line p-3" : "rounded-lg border p-3";
  const lbl = variant === "pt" ? "text-[11px] uppercase tracking-wide text-pt-muted" : "text-xs uppercase tracking-wide text-muted-foreground";
  const red = variant === "pt" ? "text-pt-red" : "text-destructive";
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="pt-balance-breakdown">
      {items.map((i) => (
        <div key={i.label} className={box} title={i.tip}>
          <div className={lbl}>{i.label}</div>
          <div className={`text-[15px] font-medium mt-1 ${i.alert && i.value > 0 ? red : ""}`}>{formatCents(i.value)}</div>
        </div>
      ))}
    </div>
  );
}
