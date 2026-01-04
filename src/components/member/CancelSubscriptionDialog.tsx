import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  accessEndDate?: Date | null;
  onSuccess: () => void;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  subscriptionId,
  accessEndDate,
  onSuccess,
}: CancelSubscriptionDialogProps) {
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "cancel_subscription",
          subscriptionId: subscriptionId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Subscription canceled. You'll retain access until the end of your billing period.");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel subscription. Please try again.");
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Cancel Subscription</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3">
            <p>
              Are you sure you want to cancel your membership subscription? 
            </p>
            {accessEndDate && (
              <div className="p-3 rounded-lg bg-secondary/50 border">
                <p className="text-sm">
                  <span className="font-medium text-foreground">Access until:</span>{" "}
                  {format(accessEndDate, "MMMM d, yyyy")}
                </p>
                <p className="text-xs mt-1">
                  You'll retain full access to all benefits until this date.
                </p>
              </div>
            )}
            <p className="text-sm">
              After cancellation:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>No further charges will be made</li>
              <li>Your credits will expire at the end of the billing period</li>
              <li>You can reactivate your membership anytime</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCanceling}
          >
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isCanceling}
          >
            {isCanceling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Canceling...
              </>
            ) : (
              "Cancel Subscription"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
