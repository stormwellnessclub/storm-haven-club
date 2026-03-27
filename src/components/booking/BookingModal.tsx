import { ClassSession } from "@/hooks/useClassSessions";
import { useBookClass } from "@/hooks/useBooking";
import { useAvailableCreditsForCategory } from "@/hooks/useUserCredits";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useAllAgreements } from "@/hooks/useAllAgreements";
import { useJoinWaitlist, useWaitlistStatus } from "@/hooks/useWaitlist";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  ExternalLink,
  Loader2,
  Check,
  ListOrdered,
} from "lucide-react";
import { format, parse, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resolvePdfUrl } from "@/lib/pdfAssets";

interface BookingModalProps {
  session: ClassSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function BookingModal({ session, open, onOpenChange }: BookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, signWaiver, isSigningWaiver } = useUserProfile();
  const { profile: nonMemberProfile } = useNonMemberProfile();
  const [paymentMethod, setPaymentMethod] = useState<"credits" | "pass">("credits");
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedPassType, setSelectedPassType] = useState<string | null>(null);
  const [showWaiverInline, setShowWaiverInline] = useState(false);
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);

  const bookClass = useBookClass();
  const joinWaitlist = useJoinWaitlist();
  const category = session?.class_type.category || "aerobics";
  const { data: creditsData, isLoading: creditsLoading } = useAvailableCreditsForCategory(category);
  const { data: waitlistStatus } = useWaitlistStatus(session ? [session.id] : []);
  const { data: agreements } = useAllAgreements();

  // Liability waiver PDF URL from agreements
  const liabilityWaiverPdf = agreements?.liability_waiver?.[0]?.pdf_url
    ? resolvePdfUrl(agreements.liability_waiver[0].pdf_url)
    : null;

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

  // Reset inline waiver state when modal closes
  useEffect(() => {
    if (!open) {
      setShowWaiverInline(false);
      setWaiverAcknowledged(false);
    }
  }, [open]);

  // Check liability waiver — check member profile first, fall back to non-member profile
  const hasLiabilityWaiver = profile?.waiver_signed === true || nonMemberProfile?.waiver_signed === true;

  if (!session) return null;

  const startTime = parse(session.start_time, "HH:mm:ss", new Date());
  const sessionDate = parseISO(session.session_date);
  const spotsRemaining = session.max_capacity - session.current_enrollment;
  const isClassFull = spotsRemaining <= 0;
  const myWaitlistEntry = waitlistStatus?.[session.id];
  const isOnWaitlist = !!myWaitlistEntry;

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

  const handleJoinWaitlist = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }
    await joinWaitlist.mutateAsync({ sessionId: session.id });
    // Keep modal open so user sees their position
  };

  const handlePurchasePass = () => {
    onOpenChange(false);
    navigate("/class-passes");
  };

  const handleSignWaiverInline = async () => {
    await signWaiver();
    setShowWaiverInline(false);
    setWaiverAcknowledged(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
              {isClassFull ? (
                <span className="text-destructive">Class is full</span>
              ) : (
                <>{spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining</>
              )}
            </div>
          </div>

          {/* Cancellation Policy */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Free cancellation up to 24 hours before class. Late cancellations
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

          {/* Liability Waiver Required — Inline Signing */}
          {user && !creditsLoading && !hasNoPaymentOptions && !hasLiabilityWaiver && (
            <div className="space-y-3">
              <Alert className="bg-destructive/10 border-destructive/30">
                <FileCheck className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">Liability Waiver Required</AlertTitle>
                <AlertDescription className="mt-1">
                  Sign the liability waiver below to continue booking.
                </AlertDescription>
              </Alert>

              {!showWaiverInline ? (
                <Button
                  onClick={() => setShowWaiverInline(true)}
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Sign Liability Waiver
                </Button>
              ) : (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <p className="text-sm font-medium">Liability Waiver</p>

                  {liabilityWaiverPdf && (
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <a href={liabilityWaiverPdf} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open & Review Waiver PDF
                      </a>
                    </Button>
                  )}

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="waiver-inline"
                      checked={waiverAcknowledged}
                      onCheckedChange={(v) => setWaiverAcknowledged(v === true)}
                    />
                    <label
                      htmlFor="waiver-inline"
                      className="text-sm leading-snug cursor-pointer"
                    >
                      I have reviewed the Liability Waiver and agree to its terms
                    </label>
                  </div>

                  <Button
                    onClick={handleSignWaiverInline}
                    disabled={!waiverAcknowledged || isSigningWaiver}
                    className="w-full"
                  >
                    {isSigningWaiver ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        I Agree — Sign Waiver & Continue
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selection */}
          {user && !creditsLoading && !hasNoPaymentOptions && hasLiabilityWaiver && (
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
          {(!user || (!hasNoPaymentOptions && hasLiabilityWaiver)) && (
            <Button
              onClick={handleBook}
              disabled={bookClass.isPending || (user && (hasNoPaymentOptions || !hasLiabilityWaiver))}
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
