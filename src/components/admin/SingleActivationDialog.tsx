import { useState, useMemo, useEffect } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { CalendarIcon, Zap, CreditCard, AlertCircle, Loader2, Lock, CalendarCheck, AlertTriangle, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import {
  extractTier,
  normalizeGender,
  getInitiationFee,
  getMonthlyPrice,
  getAnnualPrice,
} from "@/lib/membershipPricing";

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

type ActivationMode = "immediate" | "locked";

interface SingleActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application | null;
  onConfirm: (config: {
    mode: ActivationMode;
    startDate: Date;
    chargeAnnualFee: boolean;
    createSubscription: boolean;
    firstMonthCash?: boolean;
    cashNote?: string;
  }) => void;
  isLoading?: boolean;
  initialMode?: ActivationMode;
  isSuperAdmin?: boolean;
}

export function SingleActivationDialog({
  open,
  onOpenChange,
  application,
  onConfirm,
  isLoading = false,
  initialMode = "immediate",
  isSuperAdmin = false,
}: SingleActivationDialogProps) {
  const [activationMode, setActivationMode] = useState<ActivationMode>(initialMode);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [chargeUnpaidFees, setChargeUnpaidFees] = useState(true);
  const [createSubscription, setCreateSubscription] = useState(true);
  const [firstMonthCash, setFirstMonthCash] = useState(false);
  const [cashNote, setCashNote] = useState("");

  // Reset mode when dialog opens or initialMode changes
  useEffect(() => {
    if (open) {
      setActivationMode(initialMode);
    }
  }, [open, initialMode]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Allow up to 30 days in the past for backdating
  const minDate = addDays(today, -30);
  // For locked mode, allow up to 90 days out (grand opening flexibility)
  const maxDate = activationMode === "locked" ? addDays(today, 90) : addDays(today, 30);

  const isDateDisabled = (date: Date) => {
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    return dateToCheck < minDate || dateToCheck > maxDate;
  };

  // Check if selected date is in the past
  const isPastDate = startDate ? startDate < today : false;

  const handleConfirm = () => {
    if (!startDate || !application) return;
    
    const shouldChargeFee = 
      application.annual_fee_status !== "paid" && 
      !!application.stripe_customer_id && 
      chargeUnpaidFees;
    
    // Only create subscription for immediate mode with card on file
    const shouldCreateSubscription = 
      activationMode === "immediate" && 
      !!application.stripe_customer_id && 
      createSubscription;

    onConfirm({
      mode: activationMode,
      startDate,
      chargeAnnualFee: shouldChargeFee,
      createSubscription: shouldCreateSubscription,
      firstMonthCash: firstMonthCash && isSuperAdmin,
      cashNote: firstMonthCash && isSuperAdmin ? cashNote : undefined,
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
            {activationMode === "immediate" ? (
              <Zap className="h-5 w-5 text-primary" />
            ) : (
              <Lock className="h-5 w-5 text-primary" />
            )}
            {activationMode === "immediate" ? "Auto-Activate Member" : "Approve with Locked Date"}
          </DialogTitle>
          <DialogDescription>
            {activationMode === "immediate" 
              ? "Approve and immediately activate this membership."
              : "Approve with a fixed start date. Member will complete payment setup."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Activation Mode Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Activation Mode</label>
            <RadioGroup 
              value={activationMode} 
              onValueChange={(v) => setActivationMode(v as ActivationMode)}
              className="space-y-2"
            >
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                activationMode === "immediate" 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-muted-foreground/50"
              )}>
                <RadioGroupItem value="immediate" id="immediate" />
                <div className="flex-1">
                  <Label htmlFor="immediate" className="font-medium cursor-pointer flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Activate Immediately
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Member becomes active now, no checkout required
                  </p>
                </div>
              </div>
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                activationMode === "locked" 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-muted-foreground/50"
              )}>
                <RadioGroupItem value="locked" id="locked" />
                <div className="flex-1">
                  <Label htmlFor="locked" className="font-medium cursor-pointer flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4" />
                    Lock Date - Member Completes Setup
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Member must add payment info before start date
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

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
              <span className="text-sm text-muted-foreground">Initiation Fee</span>
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
            <label className="text-sm font-medium">
              {activationMode === "locked" ? "Locked Start Date" : "Membership Start Date"}
            </label>
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
              {activationMode === "locked" 
                ? "30 days back to 90 days out (for backdating or grand opening)"
                : "30 days back to 30 days out"}
            </p>
          </div>

          {/* Past Date Warning */}
          {isPastDate && (
            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Past date selected.</strong> Membership will be backdated to {startDate && format(startDate, 'MMM d, yyyy')}. 
                Subscription billing will be calculated from this date.
              </AlertDescription>
            </Alert>
          )}

          {/* Locked Mode Info */}
          {activationMode === "locked" && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CalendarCheck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                Member will receive an email with their locked start date and instructions to complete payment setup.
              </AlertDescription>
            </Alert>
          )}

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
                Charge initiation fee to saved card
              </label>
            </div>
          )}

          {/* Create Subscription Option - Only for immediate mode with card */}
          {activationMode === "immediate" && paymentStatus?.hasCard && (
            <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
              <Checkbox
                id="create-subscription"
                checked={createSubscription}
                onCheckedChange={(checked) => setCreateSubscription(checked === true)}
              />
              <label
                htmlFor="create-subscription"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Create dues subscription (auto-charged on start date)
              </label>
            </div>
          )}

          {/* Super-Admin: First Month Cash Option */}
          {isSuperAdmin && activationMode === "immediate" && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
                <Checkbox
                  id="first-month-cash"
                  checked={firstMonthCash}
                  onCheckedChange={(checked) => setFirstMonthCash(checked === true)}
                />
                <label
                  htmlFor="first-month-cash"
                  className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                >
                  <Banknote className="h-4 w-4" />
                  First month paid in cash
                </label>
              </div>
              {firstMonthCash && (
                <div className="space-y-2 pl-1">
                  <Alert className="border-primary/20 bg-primary/5">
                    <Banknote className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Subscription will start billing in month 2. First month dues recorded as cash payment.
                    </AlertDescription>
                  </Alert>
                  <Textarea
                    placeholder="Cash payment notes (e.g., Received $500 cash)"
                    value={cashNote}
                    onChange={(e) => setCashNote(e.target.value)}
                    className="text-sm"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}


          {!paymentStatus?.isPaid && !paymentStatus?.hasCard && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {activationMode === "locked" 
                  ? "Member will add payment info during checkout."
                  : "No card on file. Annual fee will remain unpaid."}
              </AlertDescription>
            </Alert>
          )}

          {/* Charge Summary */}
          {(() => {
            if (!paymentStatus?.hasCard) return null;
            const tier = extractTier(application.membership_plan);
            const gender = normalizeGender(application.gender);
            const willChargeInit = !paymentStatus.isPaid && chargeUnpaidFees;
            const willCreateSub = activationMode === "immediate" && createSubscription;
            const subStartsToday =
              willCreateSub && !!startDate && startDate <= today && !(firstMonthCash && isSuperAdmin);

            if (!willChargeInit && !willCreateSub) return null;

            const lines: { label: string; base: number; fee: number; note?: string; immediate: boolean }[] = [];

            if (willChargeInit) {
              const base = getInitiationFee(gender);
              lines.push({
                label: "Initiation fee",
                base,
                fee: calculateProcessingFeeFromDollars(base),
                immediate: true,
              });
            }

            if (willCreateSub) {
              if (isFoundingMember) {
                const base = getAnnualPrice(tier, gender);
                lines.push({
                  label: subStartsToday ? "First annual payment (today)" : "First annual payment",
                  base,
                  fee: calculateProcessingFeeFromDollars(base),
                  note: "Processing fee recurs each renewal.",
                  immediate: subStartsToday,
                });
              } else {
                const base = getMonthlyPrice(tier, gender);
                lines.push({
                  label: subStartsToday ? "First monthly payment (today)" : "First monthly payment",
                  base,
                  fee: calculateProcessingFeeFromDollars(base),
                  note: "Processing fee recurs each month.",
                  immediate: subStartsToday,
                });
              }
            }

            const todayLines = lines.filter((l) => l.immediate);
            const totalBase = todayLines.reduce((s, l) => s + l.base, 0);
            const totalFee = todayLines.reduce((s, l) => s + l.fee, 0);
            const grandTotal = totalBase + totalFee;

            const fmt = (n: number) =>
              n.toLocaleString("en-US", { style: "currency", currency: "USD" });

            return (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Charge summary (card on file)
                </div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="flex justify-between font-medium">
                        <span>{l.label}</span>
                        <span>{fmt(l.base + l.fee)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Base {fmt(l.base)} + processing fee {fmt(l.fee)}</span>
                      </div>
                      {l.note && (
                        <div className="text-[11px] text-muted-foreground italic">{l.note}</div>
                      )}
                    </div>
                  ))}
                </div>
                {todayLines.length > 0 && (
                  <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                    <span>Total charged today</span>
                    <span>{fmt(grandTotal)}</span>
                  </div>
                )}
                {willCreateSub && !subStartsToday && (
                  <div className="text-[11px] text-muted-foreground italic border-t pt-2">
                    Subscription begins {startDate ? format(startDate, "MMM d, yyyy") : "on start date"}; first charge (base + processing fee) runs then.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canProceed}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : activationMode === "immediate" ? (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Activate Member
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Approve with Locked Date
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}