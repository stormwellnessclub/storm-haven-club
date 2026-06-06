import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMemberArrears } from "@/hooks/useMemberArrears";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  DollarSign,
  RefreshCw,
  Loader2,
  XCircle,
  Calendar,
  CreditCard,
} from "lucide-react";

interface ArrearsCardProps {
  memberId: string;
}

export function ArrearsCard({ memberId }: ArrearsCardProps) {
  const { data, isLoading, isSyncing, syncArrears } = useMemberArrears(memberId);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  if (isLoading || !data) return null;

  const hasDebt = data.total_owed_cents > 0;
  if (!hasDebt) return null;

  const handleChargeNow = async () => {
    setIsCharging(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("charge-member-arrears", {
        body: { memberId },
      });
      if (error) throw error;
      if (res?.success) {
        toast.success(
          `Charged $${((res.amount_paid_cents ?? 0) / 100).toFixed(2)} successfully`,
        );
      } else {
        toast.error(res?.error || "Charge failed", {
          description: res?.decline_code ? `Decline code: ${res.decline_code}` : undefined,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["member-arrears", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-arrears-indicator", memberId] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-billing-health", memberId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Charge failed");
    } finally {
      setIsCharging(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <DollarSign className="h-5 w-5" />
            Amount Owed
            <Badge variant="destructive" className="ml-2">
              ${(data.total_owed_cents / 100).toFixed(2)}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isCharging}
            >
              {isCharging ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CreditCard className="h-4 w-4 mr-1" />
              )}
              Charge saved card now
            </Button>
            <Button variant="outline" size="sm" onClick={syncArrears} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Sync from Stripe
            </Button>
          </div>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Charge saved card now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to pay the oldest open invoice (${(data.total_owed_cents / 100).toFixed(2)} total
              owed) against the member's saved card on file. If the card declines, no
              charge is made and you'll see the reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCharging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleChargeNow} disabled={isCharging}>
              {isCharging ? "Charging…" : "Charge now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
