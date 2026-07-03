import { ClassSession } from "@/hooks/useClassSessions";
import { usePhoneOnFile } from "@/hooks/usePhoneOnFile";
import { PhoneRequiredGate } from "@/components/booking/PhoneRequiredGate";

import { supabase } from "@/integrations/supabase/client";
import { useBookClass } from "@/hooks/useBooking";
import { useAvailableCreditsForCategory } from "@/hooks/useUserCredits";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useAllAgreements } from "@/hooks/useAllAgreements";
import { useJoinWaitlist, useLeaveWaitlist, useWaitlistStatus, useWaitlistCounts } from "@/hooks/useWaitlist";
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
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { resolvePdfUrl } from "@/lib/pdfAssets";
import { ClassReviewsList } from "@/components/reviews/ClassReviewsList";
import { useClassTypeRatings } from "@/hooks/useClassReviews";
import { StarRating } from "@/components/reviews/StarRating";
import {
  readClassDraft,
  writeClassDraft,
  clearClassDraft,
} from "@/lib/bookingDraft";
import { BookingConfirmationDialog } from "./BookingConfirmationDialog";

interface BookingModalProps {
  session: ClassSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function BookingModal({ session, open, onOpenChange }: BookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, signWaiver, isSigningWaiver } = useUserProfile();
  const { data: membership } = useUserMembership();
  const isPastDue = !!(membership as any)?.payment_past_due;
  const { profile: nonMemberProfile } = useNonMemberProfile();
  const { hasPhone, isLoading: phoneLoading } = usePhoneOnFile();

  const [paymentMethod, setPaymentMethod] = useState<"credits" | "pass">("credits");
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedPassType, setSelectedPassType] = useState<string | null>(null);
  const [showWaiverInline, setShowWaiverInline] = useState(false);
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);
  const [isFundraiserCheckingOut, setIsFundraiserCheckingOut] = useState(false);
  const [confirmation, setConfirmation] = useState<import("./BookingConfirmationDialog").BookingConfirmationDetails | null>(null);

  const bookClass = useBookClass();
  const joinWaitlist = useJoinWaitlist();
  const leaveWaitlist = useLeaveWaitlist();
  const category = session?.class_type.category || "aerobics";
  const { data: creditsData, isLoading: creditsLoading } = useAvailableCreditsForCategory(category);
  const { data: waitlistStatus } = useWaitlistStatus(session ? [session.id] : []);
  const { data: waitlistCounts } = useWaitlistCounts(session ? [session.id] : []);
  const waitlistCount = session ? (waitlistCounts?.[session.id] || 0) : 0;
  const { data: agreements } = useAllAgreements();
  const { data: ratingsMap } = useClassTypeRatings();
  const classTypeRating = session ? ratingsMap?.[session.class_type.id] : undefined;

  // Liability waiver PDF URL from agreements
  const liabilityWaiverPdf = agreements?.liability_waiver?.[0]?.pdf_url
    ? resolvePdfUrl(agreements.liability_waiver[0].pdf_url)
    : null;

  // Determine available payment options
  const canUseMemberCredits = creditsData?.hasClassCredits;
  const canUsePass = creditsData?.availablePasses && creditsData.availablePasses.length > 0;
  const hasNoPaymentOptions = !canUseMemberCredits && !canUsePass;

  // Restore from persisted draft when this session matches the saved draft.
  // Otherwise set defaults ONCE per session id — never re-run on creditsData
  // identity changes (the filter array is a new ref every render, which would
  // otherwise reset the user's selection mid-flow).
  const initializedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session) return;
    if (initializedSessionRef.current === session.id) return;
    // Wait until credits have loaded so defaults reflect real availability.
    if (creditsLoading) return;
    initializedSessionRef.current = session.id;

    const draft = readClassDraft();
    if (draft && draft.sessionId === session.id) {
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (typeof draft.selectedPassId !== "undefined") setSelectedPassId(draft.selectedPassId ?? null);
      if (typeof draft.selectedPassType !== "undefined") setSelectedPassType(draft.selectedPassType ?? null);
      if (typeof draft.showWaiverInline === "boolean") setShowWaiverInline(draft.showWaiverInline);
      if (typeof draft.waiverAcknowledged === "boolean") setWaiverAcknowledged(draft.waiverAcknowledged);
      return;
    }
    if (canUseMemberCredits) {
      setPaymentMethod("credits");
      setSelectedPassId(null);
      setSelectedPassType(null);
    } else if (canUsePass && creditsData?.availablePasses?.[0]) {
      setPaymentMethod("pass");
      setSelectedPassId(creditsData.availablePasses[0].id);
      setSelectedPassType(creditsData.availablePasses[0].pass_type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, creditsLoading]);

  // Persist draft as user changes selections — keyed by session id.
  // Note: do NOT reset on dismiss; users can resume.
  useEffect(() => {
    if (!session || !open) return;
    writeClassDraft({
      sessionId: session.id,
      sessionDate: session.session_date,
      paymentMethod,
      selectedPassId,
      selectedPassType,
      showWaiverInline,
      waiverAcknowledged,
    });
  }, [
    session,
    open,
    paymentMethod,
    selectedPassId,
    selectedPassType,
    showWaiverInline,
    waiverAcknowledged,
  ]);

  // Check liability waiver — check member profile first, fall back to non-member profile
  const hasLiabilityWaiver = profile?.waiver_signed === true || nonMemberProfile?.waiver_signed === true;

  if (!session) return null;

  const startTime = parse(session.start_time, "HH:mm:ss", new Date());
  const sessionDate = parseISO(session.session_date);
  const spotsRemaining = session.max_capacity - session.current_enrollment;
  const isClassFull = spotsRemaining <= 0;
  const myWaitlistEntry = waitlistStatus?.[session.id];
  const isOnWaitlist = !!myWaitlistEntry;

  const isFundraiser = !!session?.is_fundraiser;
  const fundraiserAmount = session?.override_price_cents != null ? session.override_price_cents / 100 : 40;

  const handleFundraiserCheckout = async () => {
    if (!session) return;
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }
    try {
      setIsFundraiserCheckingOut(true);
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_fundraiser_class_checkout",
          sessionId: session.id,
          successUrl: `${origin}/payment-success`,
          cancelUrl: `${origin}/schedule`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        clearClassDraft();
        onOpenChange(false);
      } else {
        throw new Error("Could not start checkout");
      }
    } catch (err: any) {
      const msg = err?.message || "Could not start checkout";
      // toast is imported via sonner in useBooking; use alert fallback through sonner
      const { toast } = await import("sonner");
      toast.error(msg);
    } finally {
      setIsFundraiserCheckingOut(false);
    }
  };

  const handleBook = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    if (isFundraiser) {
      await handleFundraiserCheckout();
      return;
    }

    // Validate payment method selection
    if (paymentMethod === "pass" && !selectedPassId) {
      return;
    }

    const result = await bookClass.mutateAsync({
      sessionId: session.id,
      paymentMethod,
      passId: selectedPassId || undefined,
    });

    clearClassDraft();
    onOpenChange(false);

    if (result?.confirmationDetails) {
      const isPortal = window.location.pathname.startsWith("/portal");
      setConfirmation({
        ...result.confirmationDetails,
        bookingsUrl: isPortal ? "/portal/bookings" : "/member/bookings",
      });
    } else {
      // Fallback toast if for some reason details didn't come through
      const { toast } = await import("sonner");
      toast.success("Class booked successfully!");
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }
    if (paymentMethod === "pass" && !selectedPassId) return;
    await joinWaitlist.mutateAsync({
      sessionId: session.id,
      paymentMethod,
      passId: paymentMethod === "pass" ? selectedPassId : null,
    });
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
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-[500px] max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
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
                <span className="text-destructive">Class is full{waitlistCount > 0 ? ` · ${waitlistCount} on waitlist` : ""}</span>
              ) : (
                <>{spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining</>
              )}
            </div>
          </div>

          {/* Cancellation Policy — only when booking (not waitlist) */}
          {!isClassFull && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Free cancellation up to 24 hours before class. Late cancellations
                will forfeit your credit or pass.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {user && !isClassFull && creditsLoading && (
            <div className="py-4 text-center text-muted-foreground">
              Checking payment options...
            </div>
          )}

          {/* Fundraiser Donation Panel — replaces credits/pass selection */}
          {user && !isClassFull && isFundraiser && (
            <div className="rounded-lg border border-rose-300/60 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-100 font-semibold">
                <CreditCard className="h-4 w-4" />
                Donation Checkout — ${fundraiserAmount.toFixed(0)}
              </div>
              <p className="text-sm text-rose-900/90 dark:text-rose-100/90">
                {session.session_notes || `100% of proceeds will be donated to ${session.fundraiser_beneficiary || "the beneficiary"}.`}
              </p>
              <p className="text-xs text-rose-900/80 dark:text-rose-100/80">
                Class credits and class passes can't be used for fundraiser classes — please complete checkout to reserve your spot.
              </p>
            </div>
          )}

          {/* No Payment Options Available - Prompt to Purchase (non-fundraiser only) */}
          {user && !isClassFull && !creditsLoading && hasNoPaymentOptions && !isFundraiser && (
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
          {user && !isClassFull && !creditsLoading && (!hasNoPaymentOptions || isFundraiser) && !hasLiabilityWaiver && (
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

          {/* Payment Method Selection (also used for waitlist hold when full) */}
          {user && !creditsLoading && !hasNoPaymentOptions && hasLiabilityWaiver && !isFundraiser && (
            <>
              {isClassFull && (
                <p className="text-xs text-muted-foreground -mb-1">
                  We'll hold this credit/pass while you're on the waitlist and refund it if you leave or the spot doesn't open.
                </p>
              )}
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
            </>
          )}

          {/* No payment options available — block waitlist join */}
          {user && isClassFull && !creditsLoading && hasNoPaymentOptions && !isOnWaitlist && (
            <Alert className="bg-destructive/10 border-destructive/30">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive">A class credit or pass is required</AlertTitle>
              <AlertDescription className="mt-1">
                Joining the waitlist holds 1 class credit or 1 class on a pass. Please purchase a class pass first.
              </AlertDescription>
            </Alert>
          )}

          {/* Waitlist UI — shown when class is full */}
          {user && isClassFull && (
            <div className="space-y-3">
              {isOnWaitlist ? (
                <Alert className="bg-primary/10 border-primary/30">
                  <ListOrdered className="h-4 w-4 text-primary" />
                  <AlertTitle>You're on the Waitlist</AlertTitle>
                  <AlertDescription className="mt-1">
                    You're #{myWaitlistEntry.position} on the waitlist.
                    {myWaitlistEntry.status === "notified" && (
                      <span className="block mt-1 font-medium text-primary">
                        A spot has opened! Check your email to claim it.
                      </span>
                    )}
                    {myWaitlistEntry.status === "waiting" && (
                      <span className="block mt-1">We'll notify you if a spot opens up.</span>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <ListOrdered className="h-4 w-4" />
                  <AlertTitle>Class is Full</AlertTitle>
                  <AlertDescription className="mt-1">
                    Join the waitlist and we'll notify you if a spot opens up.
                    {waitlistCount > 0 && (
                      <span className="block mt-1 text-muted-foreground">{waitlistCount} {waitlistCount === 1 ? "person" : "people"} currently on the waitlist.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
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

          {/* Member Reviews */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Member Reviews</h3>
              {classTypeRating && classTypeRating.review_count > 0 && (
                <StarRating
                  rating={classTypeRating.average_rating}
                  size="sm"
                  showValue
                  count={classTypeRating.review_count}
                />
              )}
            </div>
            <ClassReviewsList classTypeId={session.class_type.id} initialLimit={3} />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sticky bottom-0 bg-background pt-3 pb-[env(safe-area-inset-bottom)]">
          <Button
            variant="ghost"
            onClick={() => {
              clearClassDraft();
              onOpenChange(false);
            }}
            className="min-h-[44px] sm:mr-auto"
          >
            Discard
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Save &amp; Close
          </Button>
          {/* Waitlist join button when class is full */}
          {user && isClassFull && !isOnWaitlist && (
            <Button
              onClick={handleJoinWaitlist}
              disabled={
                joinWaitlist.isPending ||
                hasNoPaymentOptions ||
                !hasLiabilityWaiver ||
                (paymentMethod === "pass" && !selectedPassId)
              }
              className="min-h-[44px]"
            >
              {joinWaitlist.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Join Waitlist & Hold {paymentMethod === "credits" ? "Credit" : "Pass"}
                </>
              )}
            </Button>
          )}
          {user && isClassFull && isOnWaitlist && (
            <Button
              variant="outline"
              onClick={async () => {
                await leaveWaitlist.mutateAsync({ waitlistId: myWaitlistEntry.id });
                onOpenChange(false);
              }}
              disabled={leaveWaitlist.isPending}
              className="min-h-[44px]"
            >
              {leaveWaitlist.isPending ? "Leaving..." : "Leave Waitlist & Refund"}
            </Button>
          )}
          {/* Normal booking button when class has spots */}
          {!isClassFull && (!user || isFundraiser || (!hasNoPaymentOptions && hasLiabilityWaiver)) && (
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {!!user && isPastDue && (
                <Alert className="border-amber-500/40 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <strong>Heads up — your dues are past due.</strong> Your booking will still go through, but your membership access is on hold until payment clears.{" "}
                    <a href="/member/payment-methods" className="underline font-medium">Update payment method</a>.
                  </AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleBook}
                disabled={
                  bookClass.isPending ||
                  isFundraiserCheckingOut ||
                  (!!user && !isFundraiser && (hasNoPaymentOptions || !hasLiabilityWaiver)) ||
                  (!!user && isFundraiser && !hasLiabilityWaiver)
                }
                className="min-h-[44px]"
              >
                {!user
                  ? "Sign In to Book"
                  : isFundraiser
                  ? (isFundraiserCheckingOut ? "Starting checkout..." : `Donate $${fundraiserAmount.toFixed(0)} & Reserve Spot`)
                  : (bookClass.isPending ? "Booking..." : "Confirm Booking")}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
      <BookingConfirmationDialog
        open={!!confirmation}
        onOpenChange={(o) => { if (!o) setConfirmation(null); }}
        details={confirmation}
      />
    </Dialog>
  );
}
