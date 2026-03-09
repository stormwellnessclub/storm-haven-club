import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarClock } from "lucide-react";
import { format, addDays } from "date-fns";

interface ChangeBillingDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  subscriptionId: string | null;
  annualFeeSubscriptionId?: string | null;
}

export function ChangeBillingDateDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  subscriptionId,
  annualFeeSubscriptionId,
}: ChangeBillingDateDialogProps) {
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateAnnualFee, setUpdateAnnualFee] = useState(true);

  const handleSubmit = async () => {
    if (!subscriptionId) {
      toast.error("No subscription found for this member");
      return;
    }

    setIsUpdating(true);
    try {
      // Update main subscription billing date
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "update_billing_anchor",
          subscriptionId,
          newBillingDate: newDate,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Also update annual fee subscription if requested
      if (updateAnnualFee && annualFeeSubscriptionId) {
        const { data: annualData, error: annualError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "update_billing_anchor",
            subscriptionId: annualFeeSubscriptionId,
            newBillingDate: newDate,
          },
        });

        if (annualError || annualData?.error) {
          console.warn("Failed to update annual fee billing date:", annualError || annualData?.error);
          toast.warning("Main subscription updated but annual fee date could not be changed");
        }
      }

      toast.success(`Billing date for ${memberName} changed to ${format(new Date(newDate), "MMMM d, yyyy")}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["autopay-schedule"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating billing date:", error);
      toast.error(error.message || "Failed to update billing date");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Change Billing Date
          </DialogTitle>
          <DialogDescription>
            Shift the next billing date for <strong>{memberName}</strong>. This is typically used after a freeze to realign payment dates. No immediate charge will be created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newBillingDate">New Next Billing Date</Label>
            <Input
              id="newBillingDate"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
            />
            <p className="text-xs text-muted-foreground">
              The member will be charged on this date, and future payments will recur monthly from here.
            </p>
          </div>

          {annualFeeSubscriptionId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="updateAnnualFee"
                checked={updateAnnualFee}
                onChange={(e) => setUpdateAnnualFee(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="updateAnnualFee" className="text-sm font-normal cursor-pointer">
                Also update annual fee subscription date
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Billing Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
