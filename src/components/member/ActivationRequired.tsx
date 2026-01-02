import { useState } from "react";
import { format, addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { Calendar, Clock, CheckCircle, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import stormLogo from "@/assets/storm-logo-gold.png";

interface MemberData {
  id: string;
  member_id: string;
  membership_type: string;
  status: string;
  approved_at: string | null;
  activation_deadline: string | null;
  activated_at: string | null;
  first_name: string;
  last_name: string;
  email: string;
  gender?: string | null;
  is_founding_member?: boolean | null;
}

interface ActivationRequiredProps {
  memberData: MemberData;
}

export function ActivationRequired({ memberData }: ActivationRequiredProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [gender, setGender] = useState<string>(memberData.gender || "female");
  const [isFoundingMember, setIsFoundingMember] = useState<boolean>(
    memberData.is_founding_member || false
  );
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  const deadlineDate = memberData.activation_deadline 
    ? new Date(memberData.activation_deadline) 
    : addDays(new Date(), 7);
  
  const today = startOfDay(new Date());
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Pricing based on tier and gender
  const getPricing = () => {
    const tier = memberData.membership_type.toLowerCase().replace(' membership', '');
    const isMen = gender === 'male';
    
    const monthlyPrices: Record<string, { women: number; men: number }> = {
      silver: { women: 200, men: 120 },
      gold: { women: 250, men: 155 },
      platinum: { women: 350, men: 175 },
      diamond: { women: 500, men: 0 },
    };
    
    const annualPrices: Record<string, { women: number; men: number }> = {
      silver: { women: 2400, men: 1440 },
      gold: { women: 3000, men: 1860 },
      platinum: { women: 4200, men: 2100 },
      diamond: { women: 6000, men: 0 },
    };
    
    const annualFees = { women: 300, men: 175 };
    
    const monthlyPrice = isMen ? monthlyPrices[tier]?.men : monthlyPrices[tier]?.women;
    const annualPrice = isMen ? annualPrices[tier]?.men : annualPrices[tier]?.women;
    const annualFee = isMen ? annualFees.men : annualFees.women;
    
    return { monthlyPrice, annualPrice, annualFee };
  };

  const { monthlyPrice, annualPrice, annualFee } = getPricing();

  const handleActivate = async () => {
    if (!selectedDate) {
      toast.error("Please select a start date");
      return;
    }

    if (!session?.access_token) {
      toast.error("Please log in to continue");
      return;
    }

    setIsLoading(true);

    try {
      const origin = window.location.origin;
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_activation_checkout",
          tier: memberData.membership_type,
          gender: gender,
          isFoundingMember: isFoundingMember,
          startDate: format(selectedDate, "yyyy-MM-dd"),
          memberId: memberData.id,
          successUrl: `${origin}/member?activation=success`,
          cancelUrl: `${origin}/member?activation=cancelled`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
      setIsLoading(false);
    }
  };

  // Date validation for calendar
  const isDateDisabled = (date: Date) => {
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today) || isAfter(dateStart, deadlineDate);
  };

  // Check if Diamond is available for men
  const isDiamondTier = memberData.membership_type.toLowerCase().includes('diamond');
  const diamondMenBlocked = isDiamondTier && gender === 'male';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={stormLogo} alt="Storm Wellness Club" className="h-16 mx-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl font-serif">Welcome, {memberData.first_name}</CardTitle>
            <CardDescription className="mt-2">
              Your membership application has been approved!
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Countdown Banner */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-accent mb-1">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">{daysRemaining} days remaining</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Please complete activation by {format(deadlineDate, "MMMM d, yyyy")}
            </p>
          </div>

          {/* Gender Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Pricing</label>
            <RadioGroup value={gender} onValueChange={setGender} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female">Women's Rates</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" disabled={isDiamondTier} />
                <Label htmlFor="male" className={isDiamondTier ? "text-muted-foreground" : ""}>
                  Men's Rates {isDiamondTier && "(N/A)"}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Billing Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Billing Option</label>
            <RadioGroup 
              value={isFoundingMember ? "annual" : "monthly"} 
              onValueChange={(v) => setIsFoundingMember(v === "annual")}
              className="space-y-3"
            >
              <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-accent/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <div>
                    <Label htmlFor="monthly" className="font-medium">Monthly Billing</Label>
                    <p className="text-sm text-muted-foreground">Pay month-to-month</p>
                  </div>
                </div>
                <span className="font-semibold">${monthlyPrice}/mo</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-accent/30 bg-accent/5 hover:border-accent/50 transition-colors">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="annual" id="annual" />
                  <div>
                    <Label htmlFor="annual" className="font-medium">Founding Member</Label>
                    <p className="text-sm text-muted-foreground">Pay full year upfront</p>
                  </div>
                </div>
                <span className="font-semibold">${annualPrice}/yr</span>
              </div>
            </RadioGroup>
          </div>

          {/* Date Picker */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Start Date</label>
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
                  {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Choose a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Summary */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Member ID</span>
              <span className="font-medium">{memberData.member_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Membership Tier</span>
              <span className="font-medium">{memberData.membership_type}</span>
            </div>
            {selectedDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium text-accent">{format(selectedDate, "MMMM d, yyyy")}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isFoundingMember ? "Annual Membership" : "Monthly Membership"}
                </span>
                <span className="font-medium">
                  ${isFoundingMember ? annualPrice : monthlyPrice}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Annual Fee (yearly)</span>
                <span className="font-medium">${annualFee}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Today's Total</span>
                <span>${(isFoundingMember ? annualPrice : monthlyPrice) + annualFee}</span>
              </div>
            </div>
          </div>

          {/* Activate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleActivate}
            disabled={!selectedDate || isLoading || diamondMenBlocked}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Continue to Payment
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You'll be redirected to our secure payment processor to complete your membership activation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
