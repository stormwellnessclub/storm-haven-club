import { ClassSession } from "@/hooks/useClassSessions";
import { useBookClass } from "@/hooks/useBooking";
import { useAvailableCreditsForCategory } from "@/hooks/useUserCredits";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Clock,
  MapPin,
  User,
  Flame,
  Calendar,
  CreditCard,
  Ticket,
  AlertCircle,
  ShoppingBag,
  FileCheck,
  ArrowRight,
} from "lucide-react";
import { format, parse, parseISO } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

interface BookingModalProps {
  session: ClassSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper to determine which agreement is needed for a payment method
function getRequiredAgreementForPaymentMethod(
  paymentMethod: "credits" | "pass",
  passType?: string
): { key: string; name: string } | null {
  if (paymentMethod === "credits") {
    // Member credits require membership agreement
    return { key: "membership_agreement_signed", name: "Membership Agreement" };
  }
  
  if (paymentMethod === "pass" && passType) {
    const lowerPassType = passType.toLowerCase();
    
    if (lowerPassType.includes("guest") || lowerPassType.includes("day")) {
      return { key: "guest_pass_agreement_signed", name: "Guest Pass Agreement" };
    }
    if (lowerPassType.includes("single") || lowerPassType === "single_class_pass") {
      return { key: "single_class_pass_agreement_signed", name: "Single Class Pass Agreement" };
    }
    if (lowerPassType.includes("10") || lowerPassType.includes("pack") || lowerPassType.includes("package")) {
      return { key: "class_package_agreement_signed", name: "Class Package Agreement" };
    }
  }
  
  return null;
}

// Get waiver page URL parameter for specific agreement type
function getWaiverUrlParam(agreementKey: string): string {
  switch (agreementKey) {
    case "guest_pass_agreement_signed":
      return "guest_pass";
    case "single_class_pass_agreement_signed":
      return "single_class_pass";
    case "class_package_agreement_signed":
      return "class_package";
    case "membership_agreement_signed":
      return "membership";
    default:
      return "";
  }
}

export function BookingModal({ session, open, onOpenChange }: BookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [paymentMethod, setPaymentMethod] = useState<"credits" | "pass">("credits");
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedPassType, setSelectedPassType] = useState<string | null>(null);

  const bookClass = useBookClass();
  const category = session?.class_type.category || "aerobics";
  const { data: creditsData, isLoading: creditsLoading } = useAvailableCreditsForCategory(category);

  // Determine available payment options
  const canUseMemberCredits = creditsData?.hasClassCredits;
  const canUsePass = creditsData?.availablePasses && creditsData.availablePasses.length > 0;
  const hasNoPaymentOptions = !canUseMemberCredits && !canUsePass;

  // Set default payment method based on availability
  useEffect(() => {
    if (canUseMemberCredits) {
      setPaymentMethod("credits");
      setSelectedPassId(null);
      setSelectedPassType(null);
    } else if (canUsePass && creditsData?.availablePasses?.[0]) {
      setPaymentMethod("pass");
      setSelectedPassId(creditsData.availablePasses[0].id);
      setSelectedPassType(creditsData.availablePasses[0].pass_type);
    }
  }, [canUseMemberCredits, canUsePass, creditsData?.availablePasses]);

  // Check liability waiver (universal requirement for ALL bookings)
  const hasLiabilityWaiver = profile?.waiver_signed === true;

  // Check if user has the required agreement for the selected payment method
  const requiredAgreement = useMemo(() => {
    return getRequiredAgreementForPaymentMethod(paymentMethod, selectedPassType || undefined);
  }, [paymentMethod, selectedPassType]);

  const hasRequiredAgreement = useMemo(() => {
    if (!requiredAgreement || !profile) return true;
    return !!(profile as any)[requiredAgreement.key];
  }, [requiredAgreement, profile]);

  if (!session) return null;

  const startTime = parse(session.start_time, "HH:mm:ss", new Date());
  const sessionDate = parseISO(session.session_date);
  const spotsRemaining = session.max_capacity - session.current_enrollment;

  const handleBook = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    // Validate payment method selection
    if (paymentMethod === "pass" && !selectedPassId) {
      return;
    }

    await bookClass.mutateAsync({
      sessionId: session.id,
      paymentMethod,
      passId: selectedPassId || undefined,
    });

    onOpenChange(false);
  };

  const handlePurchasePass = () => {
    onOpenChange(false);
    navigate("/class-passes");
  };

  const handleGoToWaivers = (waiverType?: string) => {
    const returnUrl = encodeURIComponent(window.location.pathname);
    const param = waiverType || (requiredAgreement ? getWaiverUrlParam(requiredAgreement.key) : "");
    onOpenChange(false);
    navigate(`/member/waivers?return=${returnUrl}${param ? `&type=${param}` : ""}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {session.class_type.name}
            {session.class_type.is_heated && (
              <Badge variant="destructive" className="text-xs">
                <Flame className="h-3 w-3 mr-1" />
                Hot
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Book your spot in this class
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Class Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(sessionDate, "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(startTime, "h:mm a")} ({session.class_type.duration_minutes} min)
              </span>
            </div>
            {session.instructor && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  {session.instructor.first_name} {session.instructor.last_name}
                </span>
              </div>
            )}
            {session.room && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{session.room}</span>
              </div>
            )}
            <div className="text-sm font-medium">
              {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining
            </div>
          </div>

          {/* Cancellation Policy */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Free cancellation up to 12 hours before class. Late cancellations
              will forfeit your credit or pass.
            </AlertDescription>
          </Alert>

          {/* Loading State */}
          {user && creditsLoading && (
            <div className="py-4 text-center text-muted-foreground">
              Checking payment options...
            </div>
          )}

          {/* No Payment Options Available - Prompt to Purchase */}
          {user && !creditsLoading && hasNoPaymentOptions && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <ShoppingBag className="h-4 w-4" />
                <AlertTitle>No payment method available</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-2">To book this class, you need:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Diamond membership credits (included monthly), or</li>
                    <li>A pre-purchased class pass</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={handlePurchasePass} className="flex-1">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Purchase Class Pass
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/memberships");
                  }}
                >
                  View Memberships
                </Button>
              </div>
            </div>
          )}

          {/* Liability Waiver Required Alert (takes priority) */}
          {user && !creditsLoading && !hasNoPaymentOptions && !hasLiabilityWaiver && (
            <Alert className="bg-destructive/10 border-destructive/30">
              <FileCheck className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive">Liability Waiver Required</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">
                  You must sign the <strong>Liability Waiver</strong> before booking any class.
                </p>
                <Button 
                  onClick={() => handleGoToWaivers("liability_waiver")}
                  variant="outline"
                  className="w-full"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Sign Liability Waiver
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Agreement Required Alert (only if liability waiver is signed) */}
          {user && !creditsLoading && !hasNoPaymentOptions && hasLiabilityWaiver && !hasRequiredAgreement && requiredAgreement && (
            <Alert className="bg-accent/10 border-accent/30">
              <FileCheck className="h-4 w-4 text-accent" />
              <AlertTitle className="text-accent">Agreement Required</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">
                  To book using your selected payment method, please sign the{" "}
                  <strong>{requiredAgreement.name}</strong> first.
                </p>
                <Button 
                  onClick={() => handleGoToWaivers()}
                  variant="outline"
                  className="w-full"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Go to Waivers & Agreements
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Method Selection - Only show if user has all required agreements */}
          {user && !creditsLoading && !hasNoPaymentOptions && hasLiabilityWaiver && hasRequiredAgreement && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Payment Method</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => {
                  setPaymentMethod(v as "credits" | "pass");
                  if (v === "credits") {
                    setSelectedPassId(null);
                    setSelectedPassType(null);
                  }
                }}
                className="space-y-2"
              >
                {canUseMemberCredits && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="credits" id="credits" />
                    <Label htmlFor="credits" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Diamond Member Credit</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {creditsData?.classCreditsRemaining} credits remaining this cycle
                      </p>
                    </Label>
                  </div>
                )}

                {canUsePass &&
                  creditsData?.availablePasses.map((pass) => (
                    <div
                      key={pass.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <RadioGroupItem
                        value="pass"
                        id={`pass-${pass.id}`}
                        onClick={() => {
                          setPaymentMethod("pass");
                          setSelectedPassId(pass.id);
                          setSelectedPassType(pass.pass_type);
                        }}
                      />
                      <Label htmlFor={`pass-${pass.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-primary" />
                          <span>{pass.pass_type}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pass.classes_remaining} of {pass.classes_total} classes remaining
                        </p>
                      </Label>
                    </div>
                  ))}
              </RadioGroup>
            </div>
          )}

          {!user && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please sign in or create an account to book this class.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/* Only show book button if user has all waivers/agreements signed */}
          {(!user || (!hasNoPaymentOptions && hasLiabilityWaiver && hasRequiredAgreement)) && (
            <Button
              onClick={handleBook}
              disabled={bookClass.isPending || (user && (hasNoPaymentOptions || !hasLiabilityWaiver || !hasRequiredAgreement))}
            >
              {bookClass.isPending
                ? "Booking..."
                : !user
                ? "Sign In to Book"
                : "Confirm Booking"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
