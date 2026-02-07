import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useCardSyncFailures, 
  useRetryCardSync, 
  useResolveCardSyncFailure 
} from "@/hooks/useCardSyncStatus";
import { AlertTriangle, RefreshCw, CreditCard, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function CardSyncFailuresWidget() {
  const { data: failures, isLoading, error } = useCardSyncFailures();
  const retryMutation = useRetryCardSync();
  const resolveMutation = useResolveCardSyncFailure();

  const handleRetry = async (failure: typeof failures extends (infer T)[] ? T : never) => {
    try {
      await retryMutation.mutateAsync({
        failureId: failure.id,
        memberId: failure.member_id || undefined,
        stripeCustomerId: failure.stripe_customer_id || undefined,
      });
      toast.success("Card sync successful!");
    } catch (e: any) {
      toast.error(`Retry failed: ${e.message}`);
    }
  };

  const handleDismiss = async (failureId: string) => {
    try {
      await resolveMutation.mutateAsync(failureId);
      toast.success("Marked as resolved");
    } catch (e: any) {
      toast.error(`Failed to dismiss: ${e.message}`);
    }
  };

  const handleRetryAll = async () => {
    if (!failures?.length) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const failure of failures) {
      try {
        await retryMutation.mutateAsync({
          failureId: failure.id,
          memberId: failure.member_id || undefined,
          stripeCustomerId: failure.stripe_customer_id || undefined,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`${successCount} card(s) synced successfully`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} sync(s) still failing`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Silently fail - don't block dashboard
  }

  const unresolvedCount = failures?.length || 0;

  // No failures - show success state
  if (unresolvedCount === 0) {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-accent">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">All card metadata synced</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Critical alert for failures
  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">Card Sync Failures</CardTitle>
            <Badge variant="destructive">{unresolvedCount}</Badge>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRetryAll}
            disabled={retryMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
            Retry All
          </Button>
        </div>
        <CardDescription>
          These members may not be chargeable - card data failed to sync
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {failures?.slice(0, 5).map((failure) => (
          <Alert key={failure.id} variant="destructive" className="py-3">
            <CreditCard className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>
                {failure.member?.first_name} {failure.member?.last_name}
                {failure.member?.member_id && (
                  <span className="ml-2 text-xs font-mono opacity-70">
                    {failure.member.member_id}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => handleRetry(failure)}
                  disabled={retryMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => handleDismiss(failure.id)}
                  disabled={resolveMutation.isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </AlertTitle>
            <AlertDescription className="text-xs">
              {failure.error_message || "Unknown error"} • 
              {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
              {failure.retry_count > 0 && ` • ${failure.retry_count} retries`}
            </AlertDescription>
          </Alert>
        ))}
        
        {unresolvedCount > 5 && (
          <p className="text-sm text-muted-foreground text-center">
            +{unresolvedCount - 5} more failures
          </p>
        )}
      </CardContent>
    </Card>
  );
}