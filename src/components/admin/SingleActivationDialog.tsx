import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon, Zap, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  membership_plan: string;
  annual_fee_status: string;
  stripe_customer_id: string | null;
  founding_member: string;
  gender: string;
}

interface SingleActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application | null;
  onConfirm: (config: {
    startDate: Date;
    chargeAnnualFee: boolean;
  }) => void;
  isLoading?: boolean;
}

export function SingleActivationDialog({
  open,
  onOpenChange,
  application,
  onConfirm,
  isLoading = false,
}: SingleActivationDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [chargeUnpaidFees, setChargeUnpaidFees] = useState(true);

  const today = new Date();
  const maxDate = addDays(today, 30);

  const isDateDisabled = (date: Date) => {
    return date < today || date > maxDate;
  };

  const handleConfirm = () => {
    if (!startDate || !application) return;
    
    const shouldChargeFee = 
      application.annual_fee_status !== "paid" && 
      !!application.stripe_customer_id && 
      chargeUnpaidFees;

    onConfirm({
      startDate,
      chargeAnnualFee: shouldChargeFee,
    });
  };

  // Analyze application payment status
  const paymentStatus = useMemo(() => {
    if (!application) return null;
    
    const isPaid = application.annual_fee_status === "paid";
    const hasCard = !!application.stripe_customer_id;
    
    return { isPaid, hasCard };
  }, [application]);

  const canProceed = !!startDate && !isLoading;

  if (!application) return null;

  const displayName = application.first_name || application.full_name?.split(" ")[0] || "Applicant";
  const isFoundingMember = application.founding_member?.toLowerCase() === "yes";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Auto-Activate Member
          </DialogTitle>
          <DialogDescription>
            Approve and immediately activate this membership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Applicant Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Applicant</span>
              <span className="font-medium">{application.full_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Membership</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{application.membership_plan}</span>
                {isFoundingMember && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                    Founding
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Annual Fee</span>
              {paymentStatus?.isPaid ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  Paid
                </Badge>
              ) : paymentStatus?.hasCard ? (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                  <CreditCard className="h-3 w-3 mr-1" />
                  Card on File
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Unpaid - No Card
                </Badge>
              )}
            </div>
          </div>

          {/* Start Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Membership Start Date</label>
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
                  {startDate ? format(startDate, "MMMM d, yyyy") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Today to 30 days from now
            </p>
          </div>

          {/* Charge Annual Fee Option */}
          {!paymentStatus?.isPaid && paymentStatus?.hasCard && (
            <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
              <Checkbox
                id="charge-fee"
                checked={chargeUnpaidFees}
                onCheckedChange={(checked) => setChargeUnpaidFees(checked === true)}
              />
              <label
                htmlFor="charge-fee"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Charge $300 annual fee to saved card
              </label>
            </div>
          )}

          {/* Warning for no card */}
          {!paymentStatus?.isPaid && !paymentStatus?.hasCard && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                No card on file. Annual fee will remain unpaid.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canProceed}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Activate Member
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
