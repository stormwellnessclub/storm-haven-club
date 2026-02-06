import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PaymentEventType = 
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'invoice_paid'
  | 'invoice_failed'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'refund_processed'
  | 'manual_charge'
  | 'card_added'
  | 'card_updated'
  | 'initiation_fee'
  | 'annual_fee'
  | 'status_change';

export interface PaymentTimelineEvent {
  id: string;
  type: PaymentEventType;
  date: string;
  title: string;
  description: string;
  amount?: number;
  status: 'success' | 'pending' | 'failed' | 'refunded' | 'info';
  stripeObjectId?: string | null;
  stripeObjectType?: 'payment_intent' | 'subscription' | 'invoice' | 'refund' | 'charge';
  metadata?: Record<string, any>;
}

interface PaymentTimelineFilters {
  dateFrom?: Date;
  dateTo?: Date;
  eventTypes?: PaymentEventType[];
}

export function useAdminPaymentTimeline(
  memberId: string | undefined,
  filters?: PaymentTimelineFilters
) {
  return useQuery<PaymentTimelineEvent[]>({
    queryKey: ["admin-payment-timeline", memberId, filters],
    queryFn: async () => {
      if (!memberId) {
        return [];
      }

      const events: PaymentTimelineEvent[] = [];

      // 1. Fetch manual charges
      const { data: manualCharges, error: chargesError } = await supabase
        .from("manual_charges")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (chargesError) {
        console.error("[PaymentTimeline] Error fetching manual charges:", chargesError);
      } else {
        (manualCharges || []).forEach((charge) => {
          events.push({
            id: `charge-${charge.id}`,
            type: determineChargeType(charge.description),
            date: charge.created_at,
            title: getChargeTitle(charge.description),
            description: charge.description,
            amount: charge.amount,
            status: mapChargeStatus(charge.status),
            stripeObjectId: charge.stripe_payment_intent_id,
            stripeObjectType: 'payment_intent',
            metadata: {
              refunded_at: charge.refunded_at,
              refund_method: charge.refund_method,
              refund_notes: charge.refund_notes,
            },
          });
        });
      }

      // 2. Fetch payment attempts (subscription payments)
      const { data: paymentAttempts, error: attemptsError } = await supabase
        .from("payment_attempts")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (attemptsError) {
        console.error("[PaymentTimeline] Error fetching payment attempts:", attemptsError);
      } else {
        (paymentAttempts || []).forEach((attempt) => {
          events.push({
            id: `attempt-${attempt.id}`,
            type: attempt.status === 'succeeded' ? 'invoice_paid' : 'invoice_failed',
            date: attempt.created_at,
            title: attempt.status === 'succeeded' ? 'Payment Succeeded' : 'Payment Failed',
            description: attempt.invoice_number 
              ? `Invoice ${attempt.invoice_number}` 
              : 'Subscription payment',
            amount: attempt.amount,
            status: attempt.status === 'succeeded' ? 'success' : 'failed',
            stripeObjectId: attempt.invoice_id,
            stripeObjectType: 'invoice',
            metadata: {
              failure_message: attempt.failure_message,
              invoice_id: attempt.invoice_id,
            },
          });
        });
      }

      // 3. Fetch subscription status history
      const { data: statusHistory, error: statusError } = await supabase
        .from("subscription_status_history")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (statusError) {
        console.error("[PaymentTimeline] Error fetching status history:", statusError);
      } else {
        (statusHistory || []).forEach((history) => {
          events.push({
            id: `status-${history.id}`,
            type: mapStatusChangeType(history.old_status, history.new_status),
            date: history.created_at,
            title: getStatusChangeTitle(history.old_status, history.new_status),
            description: history.change_reason || `Status changed from ${history.old_status || 'none'} to ${history.new_status}`,
            status: 'info',
            stripeObjectId: history.stripe_event_id,
            stripeObjectType: 'subscription',
            metadata: {
              old_status: history.old_status,
              new_status: history.new_status,
              changed_by: history.changed_by,
            },
          });
        });
      }

      // 4. Fetch refund requests
      const { data: refundRequests, error: refundError } = await supabase
        .from("refund_requests")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (refundError) {
        console.error("[PaymentTimeline] Error fetching refund requests:", refundError);
      } else {
        (refundRequests || []).forEach((refund) => {
          if (refund.status === 'completed') {
            events.push({
              id: `refund-${refund.id}`,
              type: 'refund_processed',
              date: refund.processed_at || refund.created_at,
              title: 'Refund Processed',
              description: refund.reason || `Refund of $${(refund.amount_cents / 100).toFixed(2)}`,
              amount: refund.amount_cents,
              status: 'refunded',
              stripeObjectId: refund.stripe_refund_id,
              stripeObjectType: 'refund',
              metadata: {
                original_charge_id: refund.original_charge_id,
                refund_type: refund.refund_type,
              },
            });
          }
        });
      }

      // 5. Fetch payment method updates
      const { data: paymentMethodUpdates, error: pmError } = await supabase
        .from("payment_method_updates")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      if (pmError) {
        console.error("[PaymentTimeline] Error fetching payment method updates:", pmError);
      } else {
        (paymentMethodUpdates || []).forEach((update) => {
          const isNew = update.event_type === 'added' || update.event_type === 'attached';
          events.push({
            id: `pm-${update.id}`,
            type: isNew ? 'card_added' : 'card_updated',
            date: update.created_at,
            title: isNew ? 'Card Added' : 'Card Updated',
            description: `${update.card_brand || 'Card'} ending in ${update.card_last4 || '****'}`,
            status: 'info',
            metadata: {
              card_brand: update.card_brand,
              card_last4: update.card_last4,
              event_type: update.event_type,
              is_default: update.is_default,
            },
          });
        });
      }

      // Sort all events by date (newest first)
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Apply filters
      let filteredEvents = events;

      if (filters?.dateFrom) {
        filteredEvents = filteredEvents.filter(
          (e) => new Date(e.date) >= filters.dateFrom!
        );
      }

      if (filters?.dateTo) {
        filteredEvents = filteredEvents.filter(
          (e) => new Date(e.date) <= filters.dateTo!
        );
      }

      if (filters?.eventTypes && filters.eventTypes.length > 0) {
        filteredEvents = filteredEvents.filter(
          (e) => filters.eventTypes!.includes(e.type)
        );
      }

      return filteredEvents;
    },
    enabled: !!memberId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false,
  });
}

// Helper functions
function determineChargeType(description: string): PaymentEventType {
  const lower = description.toLowerCase();
  if (lower.includes('initiation fee')) return 'initiation_fee';
  if (lower.includes('annual fee')) return 'annual_fee';
  if (lower.includes('refund')) return 'refund_processed';
  return 'manual_charge';
}

function getChargeTitle(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('initiation fee')) return 'Initiation Fee Charged';
  if (lower.includes('annual fee')) return 'Annual Fee Charged';
  return 'Manual Charge';
}

function mapChargeStatus(status: string): PaymentTimelineEvent['status'] {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'pending':
      return 'pending';
    case 'failed':
      return 'failed';
    case 'refunded':
    case 'partially_refunded':
      return 'refunded';
    default:
      return 'info';
  }
}

function mapStatusChangeType(oldStatus: string | null, newStatus: string): PaymentEventType {
  if (newStatus === 'canceled') return 'subscription_canceled';
  if (newStatus === 'paused') return 'subscription_paused';
  if (newStatus === 'active' && oldStatus === 'paused') return 'subscription_resumed';
  if (!oldStatus || oldStatus === 'incomplete') return 'subscription_created';
  return 'subscription_updated';
}

function getStatusChangeTitle(oldStatus: string | null, newStatus: string): string {
  if (newStatus === 'canceled') return 'Subscription Canceled';
  if (newStatus === 'paused') return 'Subscription Paused';
  if (newStatus === 'active' && oldStatus === 'paused') return 'Subscription Resumed';
  if (!oldStatus || oldStatus === 'incomplete') return 'Subscription Created';
  return 'Subscription Status Changed';
}
