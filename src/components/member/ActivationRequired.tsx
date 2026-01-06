import { useState, useEffect } from "react";
import { format, addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { Calendar, Clock, Loader2, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import stormLogo from "@/assets/storm-logo-gold.png";
import { secureInvoke } from "@/lib/secureSupabaseCall";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StripeProvider } from "@/components/StripeProvider";
import { MembershipActivationPayment } from "./MembershipActivationPayment";
import { StripeProvider } from "@/components/StripeProvider";
import { MembershipActivationPayment } from "./MembershipActivationPayment";
import { StripeProvider } from "@/components/StripeProvider";
import { MembershipActivationPayment } from "./MembershipActivationPayment";

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
  annual_fee_paid_at?: string | null;
  locked_start_date?: string | null;
}

interface ActivationRequiredProps {
  memberData: MemberData;
}

export function ActivationRequired({ memberData }: ActivationRequiredProps) {
  // Check if start date is locked by admin
  const hasLockedDate = !!memberData.locked_start_date;
  const lockedDate = hasLockedDate ? new Date(memberData.locked_start_date!) : null;
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    lockedDate || undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [gender, setGender] = useState<string>(memberData.gender || "female");
  const [isFoundingMember, setIsFoundingMember] = useState<boolean>(
    memberData.is_founding_member || false
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [annualFeeAlreadyPaid, setAnnualFeeAlreadyPaid] = useState<boolean>(false);
  const [checkingFeeStatus, setCheckingFeeStatus] = useState(true);
  const { session } = useAuth();
  const navigate = useNavigate();

  // Check if annual fee was already paid (via member record or application)
  useEffect(() => {
    const checkAnnualFeeStatus = async () => {
      setCheckingFeeStatus(true);
      try {
        // First check member's annual_fee_paid_at field
        if (memberData.annual_fee_paid_at) {
          setAnnualFeeAlreadyPaid(true);
          setCheckingFeeStatus(false);
          return;
        }
        
        // Check if there's an application with paid annual fee status
        const { data: applicationData } = await supabase
          .from("membership_applications")
          .select("annual_fee_status")
          .ilike("email", memberData.email)
          .eq("annual_fee_status", "paid")
          .maybeSingle();
        
        if (applicationData) {
          setAnnualFeeAlreadyPaid(true);
          setCheckingFeeStatus(false);
          return;
        }
        
        // Check for manual charges with "Annual" in description
        const { data: chargeData } = await supabase
          .from("manual_charges")
          .select("id, description")
          .eq("status", "succeeded")
          .ilike("description", "%annual%fee%")
          .or(`member_id.eq.${memberData.id}`)
          .limit(1);
        
        if (chargeData && chargeData.length > 0) {
          setAnnualFeeAlreadyPaid(true);
        }
      } catch (err) {
        console.error("Error checking annual fee status:", err);
      } finally {
        setCheckingFeeStatus(false);
      }
    };
    
    checkAnnualFeeStatus();
  }, [memberData]);

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
      navigate("/auth");
      return;
    }

    setIsLoading(true);

    try {
      // Calculate total amount
      const { monthlyPrice, annualPrice, annualFee } = getPricing();
      let totalAmount = 0;
      
      if (isFoundingMember) {
        // Founding members pay annual upfront
        totalAmount = annualPrice;
        if (!annualFeeAlreadyPaid) {
          totalAmount += annualFee;
        }
      } else {
        // Regular members pay monthly + annual fee if not paid
        totalAmount = monthlyPrice;
        if (!annualFeeAlreadyPaid) {
          totalAmount += annualFee;
        }
      }
      
      setPaymentAmount(totalAmount);

      // Create payment intent for embedded payment
      const result = await secureInvoke<{ clientSecret?: string; error?: string }>("stripe-payment", {
        body: {
          action: "create_subscription_payment_intent",
          tier: memberData.membership_type,
          gender: gender,
          isFoundingMember: isFoundingMember,
          startDate: format(selectedDate, "yyyy-MM-dd"),
          memberId: memberData.id,
          skipAnnualFee: annualFeeAlreadyPaid,
        },
      });

      // Handle auth failure
      if (result.authFailed) {
        toast.error("Your session expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      if (result.error || result.data?.error) {
        throw new Error(result.error || result.data?.error || "Failed to initialize payment");
      }

      if (result.data?.clientSecret) {
        // Show embedded payment form
        setPaymentClientSecret(result.data.clientSecret);
        setShowPaymentForm(true);
        setIsLoading(false);
      } else {
        throw new Error("No payment client secret returned");
      }
    } catch (error: any) {
      console.error("Payment initialization error:", error);
      toast.error(error.message || "Failed to initialize payment. Please try again.");
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    setPaymentClientSecret(null);
    toast.success("Payment successful! Your membership is being activated...");
    // Refresh page to show updated status
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
    setPaymentClientSecret(null);
    setIsLoading(false);
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
          {/* Countdown Banner - hide if date is locked */}
          {!hasLockedDate && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-accent mb-1">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">{daysRemaining} days remaining</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Please complete activation by {format(deadlineDate, "MMMM d, yyyy")}
              </p>
            </div>
          )}

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

          {/* Date Picker or Locked Date Display */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {hasLockedDate ? "Your Membership Start Date" : "Select Start Date"}
            </label>
            {hasLockedDate && lockedDate ? (
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{format(lockedDate, "MMMM d, yyyy")}</p>
                    <p className="text-sm text-muted-foreground">
                      Your start date has been set by the club
                    </p>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Annual Fee Already Paid Notice */}
          {annualFeeAlreadyPaid && !checkingFeeStatus && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Your annual membership fee has already been processed. Only your membership dues will be charged today.
              </AlertDescription>
            </Alert>
          )}

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
              {annualFeeAlreadyPaid ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground line-through">Annual Fee (yearly)</span>
                  <span className="font-medium text-green-600">
                    <CheckCircle className="inline h-3 w-3 mr-1" />
                    Paid
                  </span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Annual Fee (yearly)</span>
                  <span className="font-medium">${annualFee}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Today's Total</span>
                <span>
                  ${annualFeeAlreadyPaid 
                    ? (isFoundingMember ? annualPrice : monthlyPrice) 
                    : (isFoundingMember ? annualPrice : monthlyPrice) + annualFee
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form or Activate Button */}
          {!showPaymentForm ? (
            <>
              <Button
                className="w-full"
                size="lg"
                onClick={handleActivate}
                disabled={!selectedDate || isLoading || diamondMenBlocked || checkingFeeStatus}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing payment...
                  </>
                ) : checkingFeeStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking payment status...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Continue to Payment
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Secure payment processing - stay on this page
              </p>
            </>
          ) : paymentClientSecret ? (
            <div className="space-y-4">
              <StripeProvider clientSecret={paymentClientSecret}>
                <MembershipActivationPayment
                  memberId={memberData.id}
                  tier={memberData.membership_type}
                  gender={gender}
                  isFoundingMember={isFoundingMember}
                  startDate={format(selectedDate!, "yyyy-MM-dd")}
                  skipAnnualFee={annualFeeAlreadyPaid}
                  amount={paymentAmount}
                  clientSecret={paymentClientSecret || undefined}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handlePaymentCancel}
                />
              </StripeProvider>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
