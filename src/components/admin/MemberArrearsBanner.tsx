import { format } from "date-fns";
import { useMemberArrears } from "@/hooks/useMemberArrears";
import { AlertTriangle, DollarSign, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MemberArrearsBannerProps {
  memberId: string;
}

export function MemberArrearsBanner({ memberId }: MemberArrearsBannerProps) {
  const { data, isLoading, isSyncing, syncArrears } = useMemberArrears(memberId);

  if (isLoading || !data || data.total_owed_cents <= 0) return null;

  const periodLabels = data.unpaid_periods.map((p) =>
    format(new Date(p.period_start), "MMMM")
  );
  const uniqueMonths = [...new Set(periodLabels)];

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-destructive text-lg">
                ${(data.total_owed_cents / 100).toFixed(2)} owed
              </span>
              <Badge variant="destructive" className="text-xs">
                {data.unpaid_count} {data.unpaid_count === 1 ? "month" : "months"} past due
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Unpaid: {uniqueMonths.join(", ")}
              {data.latest_failure?.failure_message && (
                <span className="ml-2 text-destructive">
                  — {data.latest_failure.failure_message}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={syncArrears} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Sync
        </Button>
      </div>
    </div>
  );
}
