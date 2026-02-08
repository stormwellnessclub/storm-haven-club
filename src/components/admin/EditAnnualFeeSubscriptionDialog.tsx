import { useState, useEffect } from "react";
import { format, addDays, addYears, startOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, CalendarClock, CalendarIcon, AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAnnualFeeAmount, normalizeGender } from "@/lib/stripeProducts";
import { cn } from "@/lib/utils";

interface EditAnnualFeeSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    gender: string | null;
    membership_type: string;
    annual_fee_subscription_id: string | null;
    annual_fee_paid_at: string | null;
  };
  onSuccess: () => void;
}

export function EditAnnualFeeSubscriptionDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: EditAnnualFeeSubscriptionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updateResult, setUpdateResult] = useState<"success" | "error" | null>(null);
  const [newBillingDate, setNewBillingDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentBillingDate, setCurrentBillingDate] = useState<Date | null>(null);

  // Date constraints: Today to +365 days
  const today = startOfDay(new Date());
  const minDate = today;
  const maxDate = addDays(today, 365);

  const isDateDisabled = (date: Date) => {
    const dateToCheck = startOfDay(new Date(date));
    return dateToCheck < minDate || dateToCheck > maxDate;
  };

  const gender = normalizeGender(member.gender);
  const amount = getAnnualFeeAmount(gender);

  // Fetch current subscription details
  useEffect(() => {
    if (open && member.annual_fee_subscription_id) {
      fetchSubscriptionDetails();
    }
  }, [open, member.annual_fee_subscription_id]);

  const fetchSubscriptionDetails = async () => {
    if (!member.annual_fee_subscription_id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "get_subscription",
          subscriptionId: member.annual_fee_subscription_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.subscription?.current_period_end) {
        const periodEnd = new Date(data.subscription.current_period_end * 1000);
        setCurrentBillingDate(periodEnd);
        setNewBillingDate(periodEnd);
      }
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
      toast.error("Failed to load subscription details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBillingDate = async () => {
    if (!member.annual_fee_subscription_id) return;

    setIsSaving(true);
    setUpdateResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "update_annual_fee_billing_date",
          subscriptionId: member.annual_fee_subscription_id,
          memberId: member.id,
          newBillingDate: newBillingDate.toISOString(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUpdateResult("success");
      toast.success(`Billing date updated to ${format(newBillingDate, 'MMM d, yyyy')}`);
      
      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error("Failed to update billing date:", err);
      setUpdateResult("error");
      toast.error(err instanceof Error ? err.message : "Failed to update billing date");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving && updateResult !== "success") {
      setUpdateResult(null);
      onOpenChange(false);
    }
  };

  const getStripeSubscriptionLink = (subId: string) => {
    return `https://dashboard.stripe.com/subscriptions/${subId}`;
  };

  if (!member.annual_fee_subscription_id) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Edit Annual Fee Subscription
          </DialogTitle>
          <DialogDescription>
            Update the billing date for the initiation fee subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Member Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Member</h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="font-medium">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{member.membership_type}</Badge>
                    {member.annual_fee_paid_at && (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Fee Paid
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Current Billing Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Current Subscription</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Subscription ID:</div>
                  <div>
                    <a 
                      href={getStripeSubscriptionLink(member.annual_fee_subscription_id)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-mono text-xs"
                    >
                      {member.annual_fee_subscription_id.slice(0, 14)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="text-muted-foreground">Amount:</div>
                  <div className="font-medium">${amount.toFixed(2)}/year</div>
                  {currentBillingDate && (
                    <>
                      <div className="text-muted-foreground">Current Next Bill:</div>
                      <div className="font-medium">{format(currentBillingDate, 'MMM d, yyyy')}</div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* New Billing Date Picker */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">New Billing Date</h4>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(newBillingDate, "MMMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newBillingDate}
                      onSelect={(date) => {
                        if (date) setNewBillingDate(date);
                        setCalendarOpen(false);
                      }}
                      disabled={isDateDisabled}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Select a date within the next year
                </p>
              </div>

              {/* Info Box */}
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                  This will update the next billing date. The subscription will continue to renew yearly from the new date.
                </AlertDescription>
              </Alert>

              {/* Success State */}
              {updateResult === "success" && (
                <div className="flex items-center justify-center gap-2 py-4 text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-medium">Billing Date Updated!</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving || updateResult === "success"}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateBillingDate}
            disabled={isLoading || isSaving || updateResult === "success"}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              "Update Billing Date"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
