import { useState, useMemo } from "react";
import { format, addDays, startOfDay, isBefore } from "date-fns";
import { Calendar, Loader2, AlertCircle, CheckCircle, CreditCard, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  membership_plan: string;
  gender: string;
  founding_member: string;
  annual_fee_status: string;
  stripe_customer_id: string | null;
  status: string;
  created_at: string;
  wellness_goals: string[];
  date_of_birth: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  lifestyle_integration: string | null;
  holistic_wellness: string | null;
  referred_by_member: string;
  services_interested: string[];
  notes: string | null;
}

interface BatchActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: Application[];
  onConfirm: (config: BatchActivationConfig) => void;
  isLoading: boolean;
}

export interface BatchActivationConfig {
  startDate: Date;
  chargeUnpaidAnnualFees: boolean;
  applicationsToActivate: Application[];
  skippedApplications: Application[];
}

export function BatchActivationDialog({
  open,
  onOpenChange,
  applications,
  onConfirm,
  isLoading,
}: BatchActivationDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [chargeUnpaidFees, setChargeUnpaidFees] = useState(true);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 30); // Allow up to 30 days in the future

  // Analyze applications
  const analysis = useMemo(() => {
    const paidFee = applications.filter((app) => app.annual_fee_status === "paid");
    const unpaidWithCard = applications.filter(
      (app) => app.annual_fee_status !== "paid" && app.stripe_customer_id
    );
    const unpaidNoCard = applications.filter(
      (app) => app.annual_fee_status !== "paid" && !app.stripe_customer_id
    );

    return { paidFee, unpaidWithCard, unpaidNoCard };
  }, [applications]);

  const handleConfirm = () => {
    if (!selectedDate) return;

    // Determine which applications can be activated
    let applicationsToActivate: Application[] = [];
    let skippedApplications: Application[] = [];

    // Always include paid applications
    applicationsToActivate.push(...analysis.paidFee);

    // Handle unpaid with card
    if (chargeUnpaidFees) {
      applicationsToActivate.push(...analysis.unpaidWithCard);
    } else {
      skippedApplications.push(...analysis.unpaidWithCard);
    }

    // Applications without cards are always skipped for auto-activation
    skippedApplications.push(...analysis.unpaidNoCard);

    onConfirm({
      startDate: selectedDate,
      chargeUnpaidAnnualFees: chargeUnpaidFees,
      applicationsToActivate,
      skippedApplications,
    });
  };

  const isDateDisabled = (date: Date) => {
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today) || dateStart > maxDate;
  };

  const canProceed = selectedDate && (analysis.paidFee.length > 0 || (chargeUnpaidFees && analysis.unpaidWithCard.length > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Batch Auto-Activation
          </DialogTitle>
          <DialogDescription>
            Configure batch activation for {applications.length} selected application(s).
            Members will be created with "active" status immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
              <p className="text-2xl font-bold text-green-600">{analysis.paidFee.length}</p>
              <p className="text-xs text-green-700 dark:text-green-400">Annual Fee Paid</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
              <p className="text-2xl font-bold text-amber-600">{analysis.unpaidWithCard.length}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Unpaid (Card On File)</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
              <p className="text-2xl font-bold text-red-600">{analysis.unpaidNoCard.length}</p>
              <p className="text-xs text-red-700 dark:text-red-400">Unpaid (No Card)</p>
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Membership Start Date (for all members)</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Charge option */}
          {analysis.unpaidWithCard.length > 0 && (
            <div className="flex items-start space-x-3 p-4 rounded-lg border bg-secondary/50">
              <Checkbox
                id="charge-unpaid"
                checked={chargeUnpaidFees}
                onCheckedChange={(checked) => setChargeUnpaidFees(!!checked)}
              />
              <div className="space-y-1">
                <Label htmlFor="charge-unpaid" className="font-medium cursor-pointer">
                  Charge annual fee to saved cards
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically charge ${analysis.unpaidWithCard.some((a) => a.gender?.toLowerCase() === "men" || a.gender?.toLowerCase() === "male") ? "175-300" : "300"} annual fee to {analysis.unpaidWithCard.length} member(s) with cards on file.
                </p>
              </div>
            </div>
          )}

          {/* Warning for no-card applications */}
          {analysis.unpaidNoCard.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {analysis.unpaidNoCard.length} application(s) have unpaid annual fees and no card on file. 
                These will be <strong>skipped</strong> and require manual processing.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          <div className="p-4 rounded-lg bg-secondary/30 space-y-2">
            <p className="text-sm font-medium">Action Preview:</p>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                {analysis.paidFee.length + (chargeUnpaidFees ? analysis.unpaidWithCard.length : 0)} member(s) will be activated
              </span>
            </div>
            {chargeUnpaidFees && analysis.unpaidWithCard.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-amber-500" />
                <span>{analysis.unpaidWithCard.length} card(s) will be charged</span>
              </div>
            )}
            {(analysis.unpaidNoCard.length > 0 || (!chargeUnpaidFees && analysis.unpaidWithCard.length > 0)) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {analysis.unpaidNoCard.length + (chargeUnpaidFees ? 0 : analysis.unpaidWithCard.length)} application(s) will be skipped
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canProceed || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Activate Members
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
