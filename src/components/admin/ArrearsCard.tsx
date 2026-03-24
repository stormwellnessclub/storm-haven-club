import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMemberArrears } from "@/hooks/useMemberArrears";
import {
  AlertTriangle,
  DollarSign,
  RefreshCw,
  Loader2,
  XCircle,
  Calendar,
} from "lucide-react";

interface ArrearsCardProps {
  memberId: string;
}

export function ArrearsCard({ memberId }: ArrearsCardProps) {
  const { data, isLoading, isSyncing, syncArrears } = useMemberArrears(memberId);

  if (isLoading || !data) return null;

  const hasDebt = data.total_owed_cents > 0;

  if (!hasDebt) return null;

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <DollarSign className="h-5 w-5" />
            Amount Owed
            <Badge variant="destructive" className="ml-2">
              ${(data.total_owed_cents / 100).toFixed(2)}
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={syncArrears} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sync from Stripe
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-destructive font-medium">
          <AlertTriangle className="h-4 w-4" />
          {data.unpaid_count} unpaid billing {data.unpaid_count === 1 ? "period" : "periods"}
        </div>

        <div className="space-y-2">
          {data.unpaid_periods.map((period) => (
            <div
              key={period.id}
              className="flex items-center justify-between p-3 border border-destructive/30 bg-destructive/5 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">
                    ${((period.amount_due_cents - period.amount_paid_cents) / 100).toFixed(2)} owed
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(period.period_start), "MMM d")} – {format(new Date(period.period_end), "MMM d, yyyy")}
                  </div>
                  {period.failure_message && (
                    <p className="text-xs text-destructive mt-0.5">{period.failure_message}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-destructive border-destructive/50 text-xs">
                {period.billing_type === "annual_fee" ? "Annual Fee" : "Dues"}
              </Badge>
            </div>
          ))}
        </div>

        {data.latest_failure?.failure_message && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium">Latest decline:</span> {data.latest_failure.failure_message}</p>
              {data.latest_failure.next_retry_at && (
                <p><span className="font-medium">Next retry:</span> {format(new Date(data.latest_failure.next_retry_at), "MMM d, h:mm a")}</p>
              )}
              {data.latest_failure.attempt_count && data.latest_failure.attempt_count > 0 && (
                <p><span className="font-medium">Attempts:</span> {data.latest_failure.attempt_count}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
