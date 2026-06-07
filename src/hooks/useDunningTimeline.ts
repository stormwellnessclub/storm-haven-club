import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DunningEventType =
  | "dunning_started"
  | "dunning_email_sent"
  | "dunning_resolved"
  | "dunning_abandoned"
  | "retry_failed"
  | "retry_succeeded"
  | "admin_charge"
  | "outreach";

export interface DunningTimelineEvent {
  id: string;
  type: DunningEventType;
  date: string;
  title: string;
  description?: string;
  amount_cents?: number;
  status: "success" | "failed" | "info" | "warning";
  metadata?: Record<string, any>;
}

export function useDunningTimeline(memberId: string | null | undefined) {
  return useQuery<DunningTimelineEvent[]>({
    queryKey: ["dunning-timeline", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      if (!memberId) return [];
      const events: DunningTimelineEvent[] = [];

      // 1. payment_dunning_state — lifecycle events
      const { data: dunning } = await supabase
        .from("payment_dunning_state" as any)
        .select("*")
        .eq("member_id", memberId)
        .order("first_failed_at", { ascending: false });

      for (const d of (dunning || []) as any[]) {
        if (d.first_failed_at) {
          events.push({
            id: `dunning-start-${d.id}`,
            type: "dunning_started",
            date: d.first_failed_at,
            title: "Dunning started",
            description: d.failure_reason || d.failure_code || "Payment failed — entered dunning",
            amount_cents: d.amount_cents,
            status: "failed",
            metadata: { invoice: d.stripe_invoice_id, status: d.status },
          });
        }
        const emails = Array.isArray(d.emails_sent) ? d.emails_sent : [];
        for (let i = 0; i < emails.length; i++) {
          const e = emails[i] || {};
          const sentAt = e.sent_at || e.sentAt || e.at || null;
          if (!sentAt) continue;
          events.push({
            id: `dunning-email-${d.id}-${i}`,
            type: "dunning_email_sent",
            date: sentAt,
            title: `Dunning email — day ${e.day ?? i + 1}`,
            description: e.template || e.subject || "Past-due reminder email",
            status: "warning",
            metadata: e,
          });
        }
        if (d.recovered_at) {
          events.push({
            id: `dunning-recovered-${d.id}`,
            type: "dunning_resolved",
            date: d.recovered_at,
            title: "Payment recovered",
            description: "Dunning resolved — payment cleared",
            amount_cents: d.amount_cents,
            status: "success",
          });
        }
        if (d.abandoned_at) {
          events.push({
            id: `dunning-abandoned-${d.id}`,
            type: "dunning_abandoned",
            date: d.abandoned_at,
            title: "Dunning abandoned",
            description: "Marked as uncollectible",
            status: "failed",
          });
        }
      }

      // 2. payment_attempts — failed retries
      const { data: attempts } = await supabase
        .from("payment_attempts")
        .select("id, status, amount, created_at, succeeded_at, failure_message, invoice_number, invoice_id")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(100);

      for (const a of (attempts || []) as any[]) {
        if (a.status === "failed") {
          events.push({
            id: `attempt-fail-${a.id}`,
            type: "retry_failed",
            date: a.created_at,
            title: "Retry failed",
            description: a.failure_message || (a.invoice_number ? `Invoice ${a.invoice_number}` : "Subscription retry"),
            amount_cents: a.amount,
            status: "failed",
            metadata: { invoice_id: a.invoice_id },
          });
        } else if (a.status === "succeeded" && a.succeeded_at) {
          events.push({
            id: `attempt-ok-${a.id}`,
            type: "retry_succeeded",
            date: a.succeeded_at,
            title: "Retry succeeded",
            description: a.invoice_number ? `Invoice ${a.invoice_number}` : "Subscription payment cleared",
            amount_cents: a.amount,
            status: "success",
          });
        }
      }

      // 3. manual_charges flagged as arrears retries (admin "Charge saved card")
      const { data: charges } = await supabase
        .from("manual_charges")
        .select("id, amount, description, status, created_at")
        .eq("member_id", memberId)
        .ilike("description", "%arrears%")
        .order("created_at", { ascending: false })
        .limit(50);

      for (const c of (charges || []) as any[]) {
        const isOk = c.status === "succeeded";
        events.push({
          id: `admin-charge-${c.id}`,
          type: "admin_charge",
          date: c.created_at,
          title: isOk ? "Admin charged saved card" : "Admin charge attempt failed",
          description: c.description,
          amount_cents: c.amount,
          status: isOk ? "success" : "failed",
        });
      }

      // 4. billing_outreach_logs
      const { data: outreach } = await supabase
        .from("billing_outreach_logs" as any)
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      for (const o of (outreach || []) as any[]) {
        events.push({
          id: `outreach-${o.id}`,
          type: "outreach",
          date: o.created_at,
          title: `Outreach — ${String(o.channel || "").replace(/_/g, " ")}`,
          description: [o.outcome, o.note].filter(Boolean).join(" · "),
          status: "info",
          metadata: {
            follow_up_at: o.follow_up_at,
            created_by_email: o.created_by_email,
          },
        });
      }

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return events;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
