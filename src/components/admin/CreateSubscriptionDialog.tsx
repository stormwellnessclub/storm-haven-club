import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay, isAfter } from "date-fns";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle, CreditCard, Calendar, DollarSign, Loader2, Zap, Banknote } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Member {
  first_name: string;
  last_name: string;
  membership_type: string;
  gender?: string | null;
  billing_type?: string | null;
  is_founding_member?: boolean | null;
  membership_start_date?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  stripe_customer_id?: string | null;
}

interface CreateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  isLoading: boolean;
  onConfirm: (startDate: Date, firstChargeDate: Date | null) => void;
}

// Pricing data (matching membershipPricing.ts)
const PRICES: Record<string, Record<string, Record<string, number>>> = {
  silver: { monthly: { women: 200, men: 120 }, annual: { women: 2400, men: 1440 } },
  gold: { monthly: { women: 250, men: 155 }, annual: { women: 3000, men: 1860 } },
  platinum: { monthly: { women: 350, men: 175 }, annual: { women: 4200, men: 2100 } },
  diamond: { monthly: { women: 500, men: 500 }, annual: { women: 6000, men: 6000 } },
};

// Credit allocations (matching tier-credit-allocations memory)
const CREDITS: Record<string, { class: number; redLight: number; dryCryo: number }> = {
  silver: { class: 0, redLight: 0, dryCryo: 0 },
  gold: { class: 0, redLight: 4, dryCryo: 2 },
  platinum: { class: 0, redLight: 6, dryCryo: 4 },
  diamond: { class: 10, redLight: 10, dryCryo: 6 },
};

function normalizeTier(membership: string): string {
  const lower = membership?.toLowerCase() || "";
  if (lower.includes("diamond")) return "diamond";
  if (lower.includes("platinum")) return "platinum";
  if (lower.includes("gold")) return "gold";
  return "silver";
}

function normalizeTierDisplay(membership: string): string {
  const lower = membership?.toLowerCase() || "";
  if (lower.includes("diamond")) return "Diamond";
  if (lower.includes("platinum")) return "Platinum";
  if (lower.includes("gold")) return "Gold";
  return "Silver";
}

export function CreateSubscriptionDialog({
  open,
  onOpenChange,
  member,
  isLoading,
  onConfirm,
}: CreateSubscriptionDialogProps) {
  const [startDate, setStartDate] = useState<Date>(() => {
    const base = member.membership_start_date ? new Date(member.membership_start_date) : new Date();
    return startOfDay(base);
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [chargeCalendarOpen, setChargeCalendarOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"now" | "cash_first_month" | "cash_paid_ahead" | "custom">("now");
  const [firstChargeDate, setFirstChargeDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = member.membership_start_date ? new Date(member.membership_start_date) : new Date();
    setStartDate(startOfDay(base));
    setPaymentMode("now");
    setFirstChargeDate(null);
  }, [open, member.membership_start_date]);

  const today = startOfDay(new Date());
  const minDate = addDays(today, -30);
  const maxDate = addDays(today, 548); // 18 months

  const isDateDisabled = (date: Date) => {
    const d = startOfDay(new Date(date));
    return d < minDate || d > maxDate;
  };

  const isPastDate = startOfDay(startDate) < today;
  const isFutureDate = isAfter(startOfDay(startDate), today);
  
  // Charge date validation: must be today or in future, up to 18 months
  const isChargeDateDisabled = (date: Date) => {
    const d = startOfDay(new Date(date));
    return d < today || d > maxDate;
  };
  
  const useCustomChargeDate = paymentMode !== "now";
  
  // Determine effective charge date for display
  const effectiveChargeDate = useCustomChargeDate && firstChargeDate ? firstChargeDate : null;
  const isChargingNow = !effectiveChargeDate || startOfDay(effectiveChargeDate) <= today;
  const chargeDateFormatted = effectiveChargeDate 
    ? format(effectiveChargeDate, "MMM d, yyyy")
    : "Today";
  
  const isCashPaidAhead = paymentMode === "cash_paid_ahead" || paymentMode === "cash_first_month";
  const isLongDeferral = effectiveChargeDate && Math.abs(effectiveChargeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) > 90;

  const subscriptionPreview = useMemo(() => {
    const tier = normalizeTier(member.membership_type);
    const gender = member.gender?.toLowerCase() === "male" ? "men" : "women";
    const billingType = member.is_founding_member ? "annual" : (member.billing_type || "monthly");
    const credits = CREDITS[tier] || CREDITS.silver;
    const price = PRICES[tier]?.[billingType]?.[gender] || 0;
    const interval = billingType === "annual" ? "/yr" : "/mo";

    return {
      tier: normalizeTierDisplay(member.membership_type),
      billingType: member.is_founding_member ? "Annual (Founding)" : (billingType === "annual" ? "Annual" : "Monthly"),
      price: `$${price}${interval}`,
      credits,
      cardInfo:
        member.card_brand && member.card_last4
          ? `${member.card_brand} •••• ${member.card_last4}`
          : "No card on file",
      startDate: format(startDate, "MMM d, yyyy"),
      hasCard: !!(member.card_brand && member.card_last4),
    };
  }, [member, startDate]);

  const formatCredits = () => {
    const parts = [];
    if (subscriptionPreview.credits.class > 0) {
      parts.push(`${subscriptionPreview.credits.class} Class`);
    }
    if (subscriptionPreview.credits.redLight > 0) {
      parts.push(`${subscriptionPreview.credits.redLight} Red Light`);
    }
    if (subscriptionPreview.credits.dryCryo > 0) {
      parts.push(`${subscriptionPreview.credits.dryCryo} Dry Cryo`);
    }
    return parts.length > 0 ? parts.join(", ") : "No monthly credits";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Create Subscription
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to create a recurring Stripe subscription for{" "}
                <span className="font-semibold text-foreground">
                  {member.first_name} {member.last_name}
                </span>
                .
              </p>

              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-3">
                  <div className="text-sm font-medium text-foreground mb-2">
                    Subscription Details
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Tier:</div>
                    <div className="font-medium">
                      <Badge variant="secondary">{subscriptionPreview.tier}</Badge>
                    </div>

                    <div className="text-muted-foreground">Billing:</div>
                    <div className="font-medium">{subscriptionPreview.billingType}</div>

                    <div className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Amount:
                    </div>
                    <div className="font-medium text-foreground">{subscriptionPreview.price}</div>

                    <div className="text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      Card:
                    </div>
                    <div className={subscriptionPreview.hasCard ? "font-medium capitalize" : "text-amber-600"}>
                      {subscriptionPreview.cardInfo}
                    </div>

                    <div className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Start Date:
                    </div>
                    <div className="font-medium">
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 w-full justify-start px-2 text-left font-medium")}
                          >
                            {subscriptionPreview.startDate}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarPicker
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
                      <p className="mt-1 text-xs text-muted-foreground">30 days back to 18 months forward</p>
                    </div>

                    <div className="text-muted-foreground">Credits:</div>
                    <div className="font-medium">{formatCredits()}</div>
                  </div>
                </CardContent>
               </Card>

               {isPastDate && (
                 <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                   <span className="font-medium text-foreground">Past date selected.</span> The subscription will start immediately, and this date will be saved as the original start date.
                 </div>
               )}

               {/* First Charge Date option */}
               <Card className="bg-primary/5 border-primary/20">
                 <CardContent className="pt-4 space-y-3">
                   <div className="text-sm font-medium text-foreground flex items-center gap-2">
                     <Zap className="h-4 w-4 text-primary" />
                     When should the first payment occur?
                   </div>
                   
                   <RadioGroup
                     value={paymentMode}
                      onValueChange={(val: "now" | "cash_first_month" | "cash_paid_ahead" | "custom") => {
                        setPaymentMode(val);
                        if (val === "now") {
                          setFirstChargeDate(null);
                        } else if (val === "cash_first_month") {
                          setFirstChargeDate(addDays(startDate, 30));
                        } else if (val === "cash_paid_ahead") {
                          setFirstChargeDate(addDays(startDate, 365));
                        }
                      }}
                     className="space-y-2"
                   >
                     <div className="flex items-center space-x-2">
                       <RadioGroupItem value="now" id="charge-now" />
                       <Label htmlFor="charge-now" className="text-sm cursor-pointer">
                         Charge now
                       </Label>
                     </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cash_first_month" id="cash-first-month" />
                        <Label htmlFor="cash-first-month" className="text-sm cursor-pointer flex items-center gap-1.5">
                          <Banknote className="h-3.5 w-3.5 text-primary" />
                          First month paid in cash
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cash_paid_ahead" id="cash-paid-ahead" />
                       <Label htmlFor="cash-paid-ahead" className="text-sm cursor-pointer flex items-center gap-1.5">
                         <Banknote className="h-3.5 w-3.5 text-primary" />
                         Cash paid ahead (1 year)
                       </Label>
                     </div>
                     <div className="flex items-center space-x-2">
                       <RadioGroupItem value="custom" id="custom-date" />
                       <Label htmlFor="custom-date" className="text-sm cursor-pointer">
                         Schedule for a specific date
                       </Label>
                     </div>
                   </RadioGroup>

                   {paymentMode === "now" && (
                     <div className="text-xs text-muted-foreground">
                       Card will be charged <span className="font-medium text-foreground">today</span>. 
                       Benefits start on {subscriptionPreview.startDate}.
                     </div>
                   )}

                    {paymentMode === "cash_first_month" && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Cash covers month 1. First Stripe charge scheduled for:
                        </div>
                        <Popover open={chargeCalendarOpen} onOpenChange={setChargeCalendarOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start text-left font-medium">
                              <Calendar className="h-4 w-4 mr-2" />
                              {firstChargeDate ? format(firstChargeDate, "MMM d, yyyy") : "Select charge date..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPicker
                              mode="single"
                              selected={firstChargeDate || undefined}
                              onSelect={(date) => { if (date) setFirstChargeDate(date); setChargeCalendarOpen(false); }}
                              disabled={isChargeDateDisabled}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {paymentMode === "cash_paid_ahead" && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Member paid cash for the current period. First Stripe charge scheduled for:
                        </div>
                       <Popover open={chargeCalendarOpen} onOpenChange={setChargeCalendarOpen}>
                         <PopoverTrigger asChild>
                           <Button variant="outline" size="sm" className="w-full justify-start text-left font-medium">
                             <Calendar className="h-4 w-4 mr-2" />
                             {firstChargeDate ? format(firstChargeDate, "MMM d, yyyy") : "Select charge date..."}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                           <CalendarPicker
                             mode="single"
                             selected={firstChargeDate || undefined}
                             onSelect={(date) => { if (date) setFirstChargeDate(date); setChargeCalendarOpen(false); }}
                             disabled={isChargeDateDisabled}
                             initialFocus
                             className="pointer-events-auto"
                           />
                         </PopoverContent>
                       </Popover>
                     </div>
                   )}

                   {paymentMode === "custom" && (
                     <div className="space-y-2">
                       <div className="text-xs text-muted-foreground">
                         Select when the card should be charged:
                       </div>
                       <Popover open={chargeCalendarOpen} onOpenChange={setChargeCalendarOpen}>
                         <PopoverTrigger asChild>
                           <Button variant="outline" size="sm" className="w-full justify-start text-left font-medium">
                             <Calendar className="h-4 w-4 mr-2" />
                             {firstChargeDate ? format(firstChargeDate, "MMM d, yyyy") : "Select charge date..."}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                           <CalendarPicker
                             mode="single"
                             selected={firstChargeDate || undefined}
                             onSelect={(date) => { if (date) setFirstChargeDate(date); setChargeCalendarOpen(false); }}
                             disabled={isChargeDateDisabled}
                             initialFocus
                             className="pointer-events-auto"
                           />
                         </PopoverContent>
                       </Popover>
                     </div>
                   )}
                 </CardContent>
               </Card>

               {/* Summary for deferred billing */}
               {useCustomChargeDate && firstChargeDate && (
                 <div className={cn(
                   "rounded-md border p-3 space-y-1",
                   isLongDeferral 
                     ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30" 
                     : "border-primary/30 bg-primary/5"
                 )}>
                   <div className="text-sm font-medium text-foreground flex items-center gap-2">
                     {isCashPaidAhead ? <Banknote className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                     {isCashPaidAhead ? "Cash Paid Ahead Summary" : "Billing Summary"}
                   </div>
                   <div className="text-xs text-muted-foreground space-y-1">
                     {isCashPaidAhead && (
                       <p>• <span className="font-medium">Cash covers through:</span> {format(firstChargeDate, "MMM d, yyyy")}</p>
                     )}
                     <p>• <span className="font-medium">Benefits start:</span> {subscriptionPreview.startDate}</p>
                     <p>• <span className="font-medium">First Stripe charge:</span> {format(firstChargeDate, "MMM d, yyyy")}</p>
                     <p>• <span className="font-medium">Member active immediately</span> with full benefits</p>
                   </div>
                 </div>
               )}

               <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-2">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Important
                </div>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 ml-6 list-disc">
                  <li>
                    {useCustomChargeDate && firstChargeDate && isAfter(firstChargeDate, today)
                      ? `Member's card will be charged on ${format(firstChargeDate, "MMM d, yyyy")}`
                      : "Member's card will be charged TODAY"}
                  </li>
                  <li>Subscription cannot be undone from this portal</li>
                  <li>To cancel, use the Stripe Dashboard or "Cancel" button</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm(startDate, useCustomChargeDate ? firstChargeDate : null);
            }}
            disabled={isLoading || !subscriptionPreview.hasCard || (useCustomChargeDate && !firstChargeDate)}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isCashPaidAhead
              ? "Activate & Schedule Future Billing"
              : useCustomChargeDate && firstChargeDate && isAfter(firstChargeDate, today)
                ? "Schedule Charge & Create"
                : "Charge Now & Create"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
