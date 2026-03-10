import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminActionButton, ADMIN_ACTION_TOOLTIPS } from "@/components/admin/AdminActionButton";
import { AlertCircle, CheckCircle2, XCircle, Clock, ExternalLink, Trash2, Loader2, CalendarClock } from "lucide-react";
import { format } from "date-fns";
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

interface SubscriptionCardProps {
  member: {
    id: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    card_brand: string | null;
  };
  billingHealth?: {
    duesSubscription?: {
      status: string;
      currentPeriodEnd: string | null;
    };
  } | null;
  isCreatingSubscription: boolean;
  onCreateSubscription: () => void;
  onClearDeadSubscription: () => Promise<void>;
  isClearingSubscription: boolean;
}

const getStripeSubscriptionLink = (subscriptionId: string) => {
  return `https://dashboard.stripe.com/subscriptions/${subscriptionId}`;
};

export function SubscriptionCard({
  member,
  billingHealth,
  isCreatingSubscription,
  onCreateSubscription,
  onClearDeadSubscription,
  isClearingSubscription,
}: SubscriptionCardProps) {
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  const subscriptionStatus = billingHealth?.duesSubscription?.status;
  const isDeadSubscription = subscriptionStatus === 'incomplete' || 
                             subscriptionStatus === 'incomplete_expired' || 
                             subscriptionStatus === 'canceled';

  const handleClearClick = () => {
    setShowClearDialog(true);
  };

  const handleConfirmClear = async () => {
    setShowClearDialog(false);
    await onClearDeadSubscription();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          {member.stripe_subscription_id ? (
            <div className="space-y-2">
              {/* Show actual billing health status if available */}
              {subscriptionStatus === 'incomplete_expired' || subscriptionStatus === 'canceled' ? (
                <>
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {subscriptionStatus === 'incomplete_expired' 
                        ? 'Expired (Payment Failed)' 
                        : 'Canceled'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Subscription is no longer active in Stripe
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={handleClearClick}
                      disabled={isClearingSubscription}
                    >
                      {isClearingSubscription ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Clear Dead Subscription
                    </Button>
                    {member.stripe_customer_id && member.card_brand && (
                      <AdminActionButton
                        label="Create New Subscription"
                        tooltip="Replace the expired subscription with a new one"
                        onClick={onCreateSubscription}
                        isLoading={isCreatingSubscription}
                      />
                    )}
                  </div>
                </>
              ) : subscriptionStatus === 'past_due' ? (
                <>
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Past Due</span>
                  </div>
                  <a 
                    href={getStripeSubscriptionLink(member.stripe_subscription_id)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View in Stripe <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : subscriptionStatus === 'incomplete' ? (
                <>
                  <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Payment Failed</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Initial payment failed - subscription never started
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={handleClearClick}
                      disabled={isClearingSubscription}
                    >
                      {isClearingSubscription ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Clear Dead Subscription
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Clear this failed subscription to create a new one
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Active</span>
                  </div>
                  <a 
                    href={getStripeSubscriptionLink(member.stripe_subscription_id)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View in Stripe <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">None</span>
              </div>
              {member.stripe_customer_id && member.card_brand && (
                <AdminActionButton
                  label="Create"
                  tooltip={ADMIN_ACTION_TOOLTIPS.createSubscription}
                  onClick={onCreateSubscription}
                  isLoading={isCreatingSubscription}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Dead Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the failed subscription ID ({member.stripe_subscription_id}) from the database, 
              allowing you to create a new subscription for this member.
              <br /><br />
              <strong>Current Status:</strong> {subscriptionStatus}
              <br />
              The subscription in Stripe will not be affected - only the local reference will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear}>
              Clear Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
