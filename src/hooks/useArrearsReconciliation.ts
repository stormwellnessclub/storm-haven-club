import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ArrearsClassification =
  | "cancelled"
  | "retrying"
  | "superseded"
  | "disputed"
  | "action_needed"
  | "resolved"
  | "needs_review";

export interface ArrearReconcileResult {
  attempt_id: string;
  classification: ArrearsClassification;
  reason_code: string;
  reason_detail: string;
  application_status: string | null;
  member_status: string | null;
  member_was_pending_activation: boolean;
  stripe_subscription_status: string | null;
  next_retry_at: string | null;
  later_successful_charges: Array<{ id: string; created: string; amount: number }>;
  disputed_charges: Array<{ id: string; status: string; amount: number; created: string }>;
  this_charge_disputed: boolean;
  suggested_resolution_reason:
    | "application_cancelled"
    | "superseded_by_later_payment"
    | "stripe_retry_in_progress"
    | "disputed_charge"
    | "written_off_uncollectible"
    | "manual_resolution"
    | null;
}

/**
 * Reconciles a batch of payment_attempt IDs against Stripe + the Application Portal.
 * Returns a Map<attempt_id, ArrearReconcileResult>. Reconciles up to `batchSize` at a time
 * to avoid overwhelming the edge function.
 */
export function useArrearsReconciliation(attemptIds: string[], options?: { autoRun?: boolean; batchSize?: number }) {
  const autoRun = options?.autoRun ?? false;
  const batchSize = options?.batchSize ?? 10;
  const [results, setResults] = useState<Map<string, ArrearReconcileResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconcile = async (ids?: string[]) => {
    const target = ids ?? attemptIds;
    if (!target.length) return;
    setIsLoading(true);
    setError(null);
    try {
      const map = new Map(results);
      for (let i = 0; i < target.length; i += batchSize) {
        const batch = target.slice(i, i + batchSize);
        const { data, error: fnErr } = await supabase.functions.invoke("reconcile-arrear", {
          body: { attempt_ids: batch },
        });
        if (fnErr) throw fnErr;
        const arr = (data?.results ?? []) as ArrearReconcileResult[];
        for (const r of arr) map.set(r.attempt_id, r);
        setResults(new Map(map));
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoRun && attemptIds.length) {
      const missing = attemptIds.filter((id) => !results.has(id));
      if (missing.length) reconcile(missing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, attemptIds.join(",")]);

  return { results, reconcile, isLoading, error };
}
