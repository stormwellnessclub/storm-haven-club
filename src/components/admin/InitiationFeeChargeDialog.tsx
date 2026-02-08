import { useState } from "react";
import { format, addDays } from "date-fns";
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
import { Loader2, CreditCard, AlertTriangle, CheckCircle2, CalendarClock, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAnnualFeeAmount, normalizeGender } from "@/lib/stripeProducts";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  nickname?: string | null;
  isDefault?: boolean;
}

interface InitiationFeeChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    gender: string | null;
    membership_type: string;
    stripe_customer_id: string | null;
    card_brand?: string | null;
    card_last4?: string | null;
    card_exp_month?: number | null;
    card_exp_year?: number | null;
  };
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
}

export function InitiationFeeChargeDialog({
  open,
  onOpenChange,
  member,
  paymentMethod,
  onSuccess,
}: InitiationFeeChargeDialogProps) {
  const [isCharging, setIsCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<"success" | "error" | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Date constraints: -30 days to +90 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = addDays(today, -30);
  const maxDate = addDays(today, 90);

  const isDateDisabled = (date: Date) => {
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    return dateToCheck < minDate || dateToCheck > maxDate;
  };

  const isPastDate = startDate < today;

  // Calculate amount based on gender
  const gender = normalizeGender(member.gender);
  const amount = getAnnualFeeAmount(gender);

  // Get card info - prefer fetched payment method, fallback to member's cached card
  const cardBrand = paymentMethod?.brand || member.card_brand || null;
  const cardLast4 = paymentMethod?.last4 || member.card_last4 || null;
  const cardExpMonth = paymentMethod?.expMonth || member.card_exp_month || null;
  const cardExpYear = paymentMethod?.expYear || member.card_exp_year || null;
  const hasCard = cardBrand && cardLast4;

  const handleCreateSubscription = async () => {
    setIsCharging(true);
    setChargeResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_create_initiation_fee_subscription",
          memberId: member.id,
          startDate: startDate.toISOString(),
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        // Subscription created successfully
        setChargeResult("success");
        toast.success(
          `Successfully created Initiation Fee subscription ($${amount.toFixed(2)}/year) - ${data.cardBrand || 'Card'} •••• ${data.cardLast4 || '****'}`
        );
        
        // Close after a brief delay to show success state
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("Subscription creation failed:", err);
      setChargeResult("error");
      toast.error(err instanceof Error ? err.message : "Failed to create subscription");
    } finally {
      setIsCharging(false);
    }
  };

  const formatExpiry = () => {
    if (cardExpMonth && cardExpYear) {
      const month = String(cardExpMonth).padStart(2, "0");
      const year = String(cardExpYear).slice(-2);
      return `${month}/${year}`;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Create Initiation Fee Subscription
          </DialogTitle>
          <DialogDescription>
            This will create a yearly recurring subscription for the initiation fee.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Member Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Member</h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="font-medium">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{member.email}</p>
              <Badge variant="secondary" className="mt-1">
                {member.membership_type}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Start Date Picker */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Subscription Start Date</h4>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "MMMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    if (date) setStartDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              30 days back to 90 days forward
            </p>
          </div>

          {/* Past Date Warning */}
          {isPastDate && (
            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Past date selected.</strong> Subscription starts immediately, 
                with {format(startDate, 'MMM d, yyyy')} recorded as the original start date.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Subscription Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Subscription Details</h4>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Description</span>
              <span className="font-medium">Initiation Fee</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Amount</span>
              <span className="text-xl font-bold text-primary">
                ${amount.toFixed(2)}/year
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">Billing</span>
              <span className="font-medium flex items-center gap-1">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Recurring Yearly
              </span>
            </div>

            {hasCard ? (
              <div className="flex justify-between items-center">
                <span className="text-sm">Card</span>
                <span className="font-medium">
                  {cardBrand?.toUpperCase()} •••• {cardLast4}
                  {formatExpiry() && (
                    <span className="text-muted-foreground text-sm ml-2">
                      (exp {formatExpiry()})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">No card on file</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CalendarClock className="h-4 w-4 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This creates a yearly subscription that will automatically renew. The card will be charged immediately.
              </p>
            </div>
          </div>

          {/* Success State */}
          {chargeResult === "success" && (
            <div className="flex items-center justify-center gap-2 py-4 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-medium">Subscription Created!</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCharging || chargeResult === "success"}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubscription}
            disabled={!hasCard || isCharging || chargeResult === "success"}
          >
            {isCharging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              `Create Subscription ($${amount.toFixed(2)}/yr)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
