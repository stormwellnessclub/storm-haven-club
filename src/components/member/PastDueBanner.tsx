import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMembership } from "@/hooks/useUserMembership";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Past-due dunning banner shown to members whose latest membership invoice
 * failed and is now in the recovery cadence. Offers a one-click manual retry
 * against the saved card, plus a link to update payment method.
 */
export function PastDueBanner() {
  const { data: membership } = useUserMembership();
  const qc = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);

  const memberAny = membership as typeof membership & { payment_past_due?: boolean };
  const isPastDue = !!memberAny?.payment_past_due;

  const { data: dunning } = useQuery({
    queryKey: ["my-dunning-state", membership?.id],
    enabled: !!membership?.id && isPastDue,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_dunning_state" as any)
        .select("amount_cents, failure_reason, retry_count, status, first_failed_at")
        .eq("member_id", membership!.id)
        .eq("status", "active")
        .order("first_failed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { amount_cents: number; failure_reason: string | null; retry_count: number; status: string; first_failed_at: string } | null;
    },
    staleTime: 30_000,
  });

  if (!isPastDue) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("retry-my-payment", { body: {} });
      if (error) throw error;
      if (data?.success) {
        toast.success("Payment succeeded — thank you!");
        qc.invalidateQueries({ queryKey: ["user-membership"] });
        qc.invalidateQueries({ queryKey: ["my-dunning-state"] });
        qc.invalidateQueries({ queryKey: ["payment-status"] });
      } else {
        toast.error(data?.error || "Payment failed — please update your card");
      }
    } catch (err: any) {
      toast.error(err?.message || "Retry failed");
    } finally {
      setIsRetrying(false);
    }
  };

  const amount = dunning?.amount_cents ? `$${(dunning.amount_cents / 100).toFixed(2)}` : null;

  return (
    <div className="bg-destructive/10 border-b border-destructive/30">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-destructive">
                Payment past due{amount ? ` — ${amount} owed` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {dunning?.failure_reason || "Your last membership payment didn't go through."}
                {" "}Your benefits are paused until this is resolved.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Retrying…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1.5" /> Retry Payment</>
              )}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/member/payment-methods">
                <CreditCard className="h-4 w-4 mr-1.5" /> Update Card
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
