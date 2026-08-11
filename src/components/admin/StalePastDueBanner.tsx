import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface StalePastDueBannerProps {
  memberId: string;
}

/**
 * Shows when a member is flagged past due (which hard-blocks check-in) but has
 * no unpaid balance — usually a dunning record that never closed after a
 * Stripe smart-retry succeeded. Staff can re-check against Stripe in one click.
 */
export function StalePastDueBanner({ memberId }: StalePastDueBannerProps) {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);

  const { data } = useQuery({
    queryKey: ["stale-past-due", memberId],
    queryFn: async () => {
      const [memberRes, arrearsRes] = await Promise.all([
        supabase.from("members").select("payment_past_due").eq("id", memberId).maybeSingle(),
        supabase
          .from("billing_arrears")
          .select("id")
          .eq("member_id", memberId)
          .eq("status", "unpaid")
          .limit(1),
      ]);
      return {
        flagged: !!memberRes.data?.payment_past_due,
        hasUnpaid: (arrearsRes.data?.length ?? 0) > 0,
      };
    },
    staleTime: 0,
  });

  if (!data?.flagged || data.hasUnpaid) return null;

  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      const { data: result, error } = await supabase.functions.invoke(
        "reconcile-dunning-recovery",
        { body: { memberId } },
      );
      if (error) throw error;
      const cleared = (result as { cleared?: number })?.cleared ?? 0;
      if (cleared > 0) {
        toast.success("Past-due flag cleared — member can check in");
      } else {
        toast.info("Stripe still shows an open invoice — block kept");
      }
      queryClient.invalidateQueries({ queryKey: ["stale-past-due", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-arrears", memberId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-check failed");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Past-due flag looks stale
            </p>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              This member is blocked from check-in but has no unpaid balance on file.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRecheck} disabled={isChecking}>
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Re-check with Stripe
        </Button>
      </div>
    </div>
  );
}
