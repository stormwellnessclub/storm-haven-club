import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLedgerSyncState, useRunLedgerSync } from "@/lib/revenueLedger";

interface Props {
  /** Ledger lines in the report whose split or tax had to be estimated. */
  estimatedEntries?: number;
}

/**
 * Freshness and provenance for reports built on the revenue ledger, with a
 * manual "Sync now" for staff (the first sync backfills all history).
 */
export function LedgerStatusBar({ estimatedEntries = 0 }: Props) {
  const { data: state, isLoading } = useLedgerSyncState();
  const runSync = useRunLedgerSync();
  const [pass, setPass] = useState(0);

  const lastSuccess = state?.last_success_at ? new Date(state.last_success_at) : null;
  const lastError = state?.last_result?.error;
  const neverSynced = !isLoading && !state;

  const handleSync = () => {
    setPass(0);
    runSync.mutate((p) => setPass(p), {
      onSuccess: (passes) => toast.success(passes > 1 ? `Revenue synced (${passes} passes)` : "Revenue synced"),
      onError: (e) => toast.error(`Sync failed: ${(e as Error).message}`),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <div className="text-muted-foreground">
          {neverSynced
            ? "Revenue has not been synced yet."
            : lastSuccess
              ? <>Card payments synced from Stripe {formatDistanceToNow(lastSuccess, { addSuffix: true })}. Cash, check and Clover sales come from the app.</>
              : "Syncing is in progress."}
        </div>
        <Button size="sm" variant="outline" onClick={handleSync} disabled={runSync.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${runSync.isPending ? "animate-spin" : ""}`} />
          {runSync.isPending ? (pass > 1 ? `Syncing… pass ${pass}` : "Syncing…") : "Sync now"}
        </Button>
      </div>

      {neverSynced && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Click <strong>Sync now</strong> once to load all past payments. The first sync reads every Stripe
            transaction since November 2025 and can take a few minutes; later syncs take seconds.
          </AlertDescription>
        </Alert>
      )}

      {lastError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>The last sync stopped with an error: {lastError}</AlertDescription>
        </Alert>
      )}

      {estimatedEntries > 0 && (
        <p className="text-xs text-muted-foreground">
          {estimatedEntries} older register sale{estimatedEntries === 1 ? "" : "s"} in this period recorded no item
          prices, so the split between areas or the included 6% tax was estimated from the description. Sales made
          after this update are exact.
        </p>
      )}
    </div>
  );
}
