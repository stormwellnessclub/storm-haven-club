import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
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
import { cn } from "@/lib/utils";
import { AlertTriangle, CreditCard, Calendar, DollarSign, ExternalLink, Loader2 } from "lucide-react";

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
  onConfirm: (startDate: Date) => void;
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

  useEffect(() => {
    if (!open) return;
    const base = member.membership_start_date ? new Date(member.membership_start_date) : new Date();
    setStartDate(startOfDay(base));
  }, [open, member.membership_start_date]);

  const today = startOfDay(new Date());
  const minDate = addDays(today, -30);
  const maxDate = addDays(today, 90);

  const isDateDisabled = (date: Date) => {
    const d = startOfDay(new Date(date));
    return d < minDate || d > maxDate;
  };

  const isPastDate = startOfDay(startDate) < today;

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
      <AlertDialogContent className="max-w-md">
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
                      <p className="mt-1 text-xs text-muted-foreground">30 days back to 90 days forward</p>
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

               <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-2">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Important
                </div>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 ml-6 list-disc">
                  <li>Member's card will be charged automatically on the billing date</li>
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
              onConfirm(startDate);
            }}
            disabled={isLoading || !subscriptionPreview.hasCard}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirm & Create
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
