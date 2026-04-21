import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts unresolved failed payment attempts (status='failed' AND resolved_at IS NULL).
 * Polls every 60s and refreshes immediately on realtime INSERT/UPDATE to payment_attempts.
 */
export function useUnresolvedFailedCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("payment_attempts" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .is("resolved_at", null);
      if (!cancelled) setCount(c ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);

    const channel = supabase
      .channel("unresolved-failed-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_attempts" },
        () => fetchCount(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
