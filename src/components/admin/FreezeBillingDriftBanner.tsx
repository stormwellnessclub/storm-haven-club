import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useFreezeBillingAudit, useRepairFreezeBilling } from "@/hooks/useAdminFreezeRequests";

/**
 * Live check that every actively-frozen member is genuinely paused in Stripe.
 * Frozen-in-our-database but still-billing-in-Stripe is the exact failure that
 * caused members to be charged during their freeze, so it is surfaced loudly
 * with a one-click repair.
 */
export function FreezeBillingDriftBanner() {
  const { data, isLoading, refetch, isFetching } = useFreezeBillingAudit();
  const repair = useRepairFreezeBilling();

  if (isLoading) return null;

  const mismatches = (data?.mismatches ?? []) as Array<{ member?: string }>;

  if (mismatches.length === 0) {
    return (
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Billing paused for all active freezes</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>
            Verified against Stripe — {data?.active_freezes ?? 0} active freeze(s), none still collecting dues.
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {mismatches.length} frozen member{mismatches.length === 1 ? " is" : "s are"} still being billed
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          These members are frozen here but Stripe is still collecting dues:{" "}
          <span className="font-medium">
            {mismatches.map((m) => m.member).filter(Boolean).join(", ")}
          </span>
        </p>
        <Button size="sm" onClick={() => repair.mutate()} disabled={repair.isPending}>
          {repair.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Pause billing now
        </Button>
      </AlertDescription>
    </Alert>
  );
}
