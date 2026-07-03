import { useState, useEffect, useMemo } from "react";
import { type SpaService } from "@/hooks/useSpaManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSpaBookAppointment, useSpaBookedSlots } from "@/hooks/useSpaBooking";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useWellnessCredits } from "@/hooks/useWellnessCredits";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { usePhoneOnFile } from "@/hooks/usePhoneOnFile";
import { PhoneRequiredGate } from "@/components/booking/PhoneRequiredGate";

import { useAllAgreements } from "@/hooks/useAllAgreements";
import { useSpaServiceAvailability } from "@/hooks/useSpaManagement";
import { resolvePdfUrl } from "@/lib/pdfAssets";
import { getWellnessCreditType, getCreditTypeDisplayName, WellnessCreditType } from "@/lib/wellnessCategories";
import {
  generateAvailableStartTimes,
  hasCoverageOnDate,
  findNextAvailableSlot,
  findCoveringSlot,
  getServiceWindowForDate,
  latestStartTime,
} from "@/lib/spaAvailability";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, addMonths, startOfDay, isSameDay, addMinutes as addMinutesFn } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Clock, CreditCard, User, Loader2, Sparkles, FileCheck, ExternalLink, Check, ArrowRight, ClipboardCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/timeFormat";
import { supabase } from "@/integrations/supabase/client";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import { IntakeFormDialog } from "@/components/spa/IntakeFormDialog";
import { SpaIntakeForm } from "@/components/spa/SpaIntakeForm";
import { useIntakeForm, useSubmitIntakeForm } from "@/hooks/useSpaIntake";
import { useApplyMothersDayVoucher, redeemMothersDayVoucher } from "@/hooks/useApplyMothersDayVoucher";
import { Input } from "@/components/ui/input";
import { Heart, X } from "lucide-react";


interface SpaBookingModalProps {
  service: SpaService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVoucherCode?: string | null;
  /** If set, parent owns the post-booking intake prompt. Receives appointment info. */
  onIntakeRequired?: (info: { appointmentId: string; memberId: string | null; serviceName: string }) => void;
}

type PaymentMethodType = "card" | "member_account" | "credit";

export function SpaBookingModal({ service, open, onOpenChange, initialVoucherCode, onIntakeRequired }: SpaBookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: membership } = useUserMembership();
  const { data: wellnessCredits, refetch: refetchCredits } = useWellnessCredits();
  const { profile, signWaiver, isSigningWaiver } = useUserProfile();
  const { profile: nonMemberProfile, signWaiver: signNonMemberWaiver, isSigningWaiver: isSigningNonMemberWaiver } = useNonMemberProfile();
  const { hasPhone, isLoading: phoneLoading } = usePhoneOnFile();

  const { data: agreements } = useAllAgreements();
  const { data: availability } = useSpaServiceAvailability();
  const bookAppointment = useSpaBookAppointment();
  const queryClient = useQueryClient();

  // Wellness services (red light / dry cryo) allow same-day booking with 20-min notice
  const creditTypeForService = service ? getWellnessCreditType(service.name) : null;
  const isSameDayEligible = creditTypeForService !== null;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    isSameDayEligible ? startOfDay(new Date()) : addDays(new Date(), 1)
  );
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [memberNotes, setMemberNotes] = useState("");
  const [showWaiverInline, setShowWaiverInline] = useState(false);
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("card");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);

  // Mother's Day voucher
  const [voucherInput, setVoucherInput] = useState("");
  const { apply: applyVoucher, clear: clearVoucher, applying: applyingVoucher, applied: appliedVoucher, error: voucherError } = useApplyMothersDayVoucher();
  const usingVoucher = !!appliedVoucher;

  const { data: bookedSlots } = useSpaBookedSlots(selectedDate);

  // Intake form follow-up state (legacy fallback only)
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeAppointmentId, setIntakeAppointmentId] = useState<string | null>(null);
  const [intakeMemberId, setIntakeMemberId] = useState<string | null>(null);

  // Two-step wizard for intake-required services
  const [step, setStep] = useState<"details" | "intake">("details");
  const submitIntake = useSubmitIntakeForm();

  // In-modal booking confirmation
  type Confirmation = {
    serviceName: string;
    date: Date;
    time: string;
    durationMinutes: number;
    paymentSummary: string;
    appointmentId?: string | null;
    memberId?: string | null;
    needsIntake?: boolean;
  };
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const hasLiabilityWaiver = profile?.waiver_signed === true || nonMemberProfile?.waiver_signed === true;
  const liabilityWaiverPdf = agreements?.liability_waiver?.[0]?.pdf_url
    ? resolvePdfUrl(agreements.liability_waiver[0].pdf_url)
    : null;

  useEffect(() => {
    if (!open) {
      setShowWaiverInline(false);
      setWaiverAcknowledged(false);
      setConfirmation(null);
      setSelectedTime("");
      setMemberNotes("");
      setVoucherInput("");
      setStep("details");
      clearVoucher();
    }
  }, [open, clearVoucher]);

  // Auto-apply voucher when modal opens with a code (from ?voucher= param or member card)
  useEffect(() => {
    if (open && initialVoucherCode && !appliedVoucher && !applyingVoucher) {
      const code = initialVoucherCode.trim().toUpperCase();
      setVoucherInput(code);
      applyVoucher(code).then((res) => {
        if (res.ok) toast.success("Mother's Day voucher applied — $0 due");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialVoucherCode]);

  const handleApplyVoucher = async () => {
    const res = await applyVoucher(voucherInput);
    if (res.ok) toast.success("Mother's Day voucher applied — $0 due");
  };

  const handleSignWaiverInline = async () => {
    if (profile) {
      await signWaiver();
    } else {
      await signNonMemberWaiver();
    }
    setShowWaiverInline(false);
    setWaiverAcknowledged(false);
  };

  const creditType = service ? getWellnessCreditType(service.name) : null;
  const availableCredit = creditType && wellnessCredits ? wellnessCredits[creditType] : null;
  const canUseCredit = !!availableCredit && availableCredit.credits_remaining > 0;

  useEffect(() => {
    if (canUseCredit && paymentMethod === "card") {
      setPaymentMethod("credit");
    }
  }, [canUseCredit]);

  useEffect(() => {
    if (user && open && paymentMethod === "card") {
      supabase.functions.invoke("stripe-payment", {
        body: { action: "list_payment_methods" },
      }).then(({ data, error }) => {
        if (!error && data?.paymentMethods) {
          setSavedPaymentMethods(data.paymentMethods);
          if (data.paymentMethods.length > 0) {
            setSelectedPaymentMethodId(data.paymentMethods[0].id);
          }
        }
      });
    }
  }, [user, open, paymentMethod]);

  // Reset selected time whenever date or service changes
  useEffect(() => {
    setSelectedTime("");
  }, [selectedDate, service?.id]);

  // Compute available start times for this date/service from availability config,
  // filtering out slots already booked (including 15-min cleanup buffer).
  const availableStartTimes = useMemo(() => {
    if (!service || !selectedDate) return [];
    // For same-day wellness bookings, require ≥ 20 min notice from now
    let minStartTime: string | undefined;
    if (isSameDayEligible && isSameDay(selectedDate, new Date())) {
      const cutoff = addMinutesFn(new Date(), 20);
      minStartTime = format(cutoff, "HH:mm");
    }
    return generateAvailableStartTimes(
      availability,
      service.id,
      selectedDate,
      service.duration_minutes,
      service.cleanup_minutes,
      bookedSlots,
      undefined,
      minStartTime
    );
  }, [availability, service, selectedDate, bookedSlots, isSameDayEligible]);

  const coverageOnDate = useMemo(() => {
    if (!service || !selectedDate) return false;
    return hasCoverageOnDate(availability, service.id, selectedDate);
  }, [availability, service, selectedDate]);

  // Next available slot if current date has none
  const nextAvailable = useMemo(() => {
    if (!service || !selectedDate) return null;
    if (availableStartTimes.length > 0) return null;
    return findNextAvailableSlot(
      availability,
      service.id,
      selectedDate,
      service.duration_minutes,
      service.cleanup_minutes
    );
  }, [availability, service, selectedDate, availableStartTimes]);

  // Window hint for selected date
  const windowHint = useMemo(() => {
    if (!service || !selectedDate) return null;
    const w = getServiceWindowForDate(availability, service.id, selectedDate);
    if (!w) return null;
    const last = latestStartTime(w.end, service.duration_minutes, service.cleanup_minutes);
    return {
      start: w.start,
      end: w.end,
      latestStart: last,
    };
  }, [availability, service, selectedDate]);

  // When no service is selected the booking dialog is hidden, but we still need
  // to keep the IntakeFormDialog mounted so the post-booking intake prompt can
  // appear after the parent clears `selectedService`.
  if (!service) {
    return (
      <IntakeFormDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        appointmentId={intakeAppointmentId}
        memberId={intakeMemberId}
      />
    );
  }

  const durationMinutes = service.duration_minutes;
  const cleanupMinutes = service.cleanup_minutes;

  // Treat massage/body services as intake-required even if the DB flag is off.
  const categoryLower = (service.category || "").toLowerCase();
  const nameLower = (service.name || "").toLowerCase();
  const needsIntake =
    service.requires_intake_form === true ||
    categoryLower.includes("massage") ||
    categoryLower.includes("body") ||
    nameLower.includes("massage");

  const triggerIntake = (appointmentId: string, memberId: string | null) => {
    // Always remember so the confirmation screen can offer an "Open Intake Form" CTA.
    setIntakeAppointmentId(appointmentId);
    setIntakeMemberId(memberId);
  };

  let finalPrice = service.price;
  if (membership) {
    const tier = membership.membership_type?.toLowerCase() || "";
    let discount = 0;
    if (tier.includes("diamond")) discount = 0.12;
    else if (tier.includes("platinum")) discount = 0.10;
    else if (tier.includes("gold")) discount = 0.08;
    else if (tier.includes("silver")) discount = 0.05;

    if (discount > 0) {
      finalPrice = Math.round(service.price * (1 - discount) * 100) / 100;
    }
  }

  const handleBook = async (
    intakeValues?: Omit<Parameters<typeof submitIntake.mutateAsync>[0], "appointment_id" | "member_id">,
  ) => {
    // Persist intake form against a newly-created appointment.
    // Returns true if saved successfully (so confirmation can hide the fallback block).
    const persistIntake = async (
      appointmentId: string | null | undefined,
      memberId: string | null | undefined,
    ): Promise<boolean> => {
      if (!intakeValues || !appointmentId) return false;
      try {
        await submitIntake.mutateAsync({
          ...intakeValues,
          appointment_id: appointmentId,
          member_id: memberId ?? null,
        });
        return true;
      } catch (e: any) {
        console.error("Intake save failed:", e);
        toast.error("Booking confirmed, but the intake form did not save. You can complete it below.");
        return false;
      }
    };

    if (!user) {
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    if (!usingVoucher && paymentMethod === "card" && !selectedPaymentMethodId && savedPaymentMethods.length > 0) {
      toast.error("Please select a payment method");
      return;
    }

    // Resolve therapist + room from availability so the booking is properly assigned
    const slot = findCoveringSlot(
      availability,
      service.id,
      selectedDate,
      selectedTime,
      durationMinutes,
      cleanupMinutes
    );

    if (!slot) {
      toast.error("That time is no longer available. Please pick another.");
      return;
    }

    try {
      let paymentIntentId: string | undefined;

      if (usingVoucher) {
        const appt = await bookAppointment.mutateAsync({
          serviceId: service.id,
          serviceName: service.name,
          serviceCategory: service.category,
          servicePrice: service.price,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          durationMinutes,
          cleanupMinutes,
          memberNotes: memberNotes || undefined,
          paymentMethod: "mothers_day_voucher",
          voucherCode: appliedVoucher!.code,
          staffId: slot.therapist_id || undefined,
          roomId: slot.room_id || undefined,
        });

        try {
          await redeemMothersDayVoucher(appliedVoucher!.code, appt?.id || null);
        } catch (e: any) {
          toast.error(`Voucher redeem failed: ${e.message}. Please contact the front desk.`);
        }

        if (needsIntake && appt?.id) {
          triggerIntake(appt.id, appt.member_id || null);
        }

        const intakeSaved = await persistIntake(appt?.id, appt?.member_id);

        setConfirmation({
          serviceName: service.name,
          date: selectedDate,
          time: selectedTime,
          durationMinutes,
          paymentSummary: `Prepaid with Mother's Day Voucher (${appliedVoucher!.code})`,
          appointmentId: appt?.id ?? null,
          memberId: appt?.member_id ?? null,
          needsIntake: needsIntake && !!appt?.id && !intakeSaved,
        });
        return;
      }

      if (paymentMethod === "credit" && creditType) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "book_wellness_appointment" as any,
          {
            p_service_id: service.id,
            p_service_name: service.name,
            p_service_category: service.category,
            p_service_price: service.price,
            p_appointment_date: format(selectedDate, "yyyy-MM-dd"),
            p_appointment_time: selectedTime,
            p_duration_minutes: durationMinutes,
            p_cleanup_minutes: cleanupMinutes,
            p_credit_type: creditType,
            p_member_notes: memberNotes || null,
          }
        );

        if (rpcError) throw new Error(rpcError.message || "Failed to book with wellness credit");
        const result = rpcResult as any;
        if (!result?.success) throw new Error(result?.error || "Failed to book with wellness credit");

        refetchCredits();
        // Refresh credit history list immediately
        queryClient.invalidateQueries({ queryKey: ["member-credit-history"] });
        queryClient.invalidateQueries({ queryKey: ["spa-appointments"] });
        toast.success(
          `Booked! 1 ${getCreditTypeDisplayName(creditType)} credit used · ${result?.credits_remaining ?? "—"} remaining`
        );

        // Capture appointment id for intake follow-up (RPC returns it as appointment_id)
        const newAppointmentId = result?.appointment_id || result?.id || null;
        if (needsIntake && newAppointmentId) {
          triggerIntake(newAppointmentId, null);
        }

        const intakeSaved = await persistIntake(newAppointmentId, null);

        // Show in-modal confirmation
        setConfirmation({
          serviceName: service.name,
          date: selectedDate,
          time: selectedTime,
          durationMinutes,
          paymentSummary: `Paid with 1 ${getCreditTypeDisplayName(creditType)} Credit · ${result?.credits_remaining ?? 0} remaining`,
          appointmentId: newAppointmentId,
          memberId: null,
          needsIntake: needsIntake && !!newAppointmentId && !intakeSaved,
        });
        return;
      } else {
        if (paymentMethod === "card" && selectedPaymentMethodId) {
          // Find a Stripe customer — member first, fall back to non-member profile
          const { data: memberData } = await supabase
            .from("members")
            .select("id, stripe_customer_id")
            .eq("user_id", user.id)
            .maybeSingle();

          let stripeCustomerId: string | null = memberData?.stripe_customer_id ?? null;

          if (!stripeCustomerId) {
            const { data: nonMember } = await supabase
              .from("non_member_profiles")
              .select("stripe_customer_id")
              .eq("user_id", user.id)
              .maybeSingle();
            stripeCustomerId = nonMember?.stripe_customer_id ?? null;
          }

          if (!stripeCustomerId) {
            throw new Error("No payment method on file. Please add a payment method first.");
          }

          const totalAmountCents = Math.round(finalPrice * 100);

          const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "charge_saved_card",
              amount: totalAmountCents,
              description: `Spa Service: ${service.name}`,
              stripeCustomerId,
              paymentMethodId: selectedPaymentMethodId,
            },
          });

          if (chargeError) throw chargeError;
          if (chargeData?.error) throw new Error(chargeData.error);

          paymentIntentId = chargeData?.paymentIntentId || chargeData?.id;
        }

        const appt = await bookAppointment.mutateAsync({
          serviceId: service.id,
          serviceName: service.name,
          serviceCategory: service.category,
          servicePrice: service.price,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          durationMinutes,
          cleanupMinutes,
          memberNotes: memberNotes || undefined,
          paymentMethod,
          paymentIntentId,
          staffId: slot.therapist_id || undefined,
          roomId: slot.room_id || undefined,
        });

        if (needsIntake && appt?.id) {
          triggerIntake(appt.id, appt.member_id || null);
        }

        const intakeSaved = await persistIntake(appt?.id, appt?.member_id);

        // Build payment summary for confirmation
        let paymentSummary = "Booking confirmed";
        if (paymentMethod === "card") {
          const pm = savedPaymentMethods.find((m) => m.id === selectedPaymentMethodId);
          const last4 = pm?.card?.last4 || pm?.last4;
          const brand = pm?.card?.brand || pm?.brand || "card";
          const total = finalPrice + calculateProcessingFeeFromDollars(finalPrice);
          paymentSummary = last4
            ? `$${total.toFixed(2)} charged to ${brand} •••• ${last4}`
            : `$${total.toFixed(2)} charged to your card`;
        } else if (paymentMethod === "member_account") {
          paymentSummary = `$${finalPrice.toFixed(2)} charged to your member account`;
        }

        setConfirmation({
          serviceName: service.name,
          date: selectedDate,
          time: selectedTime,
          durationMinutes,
          paymentSummary,
          appointmentId: appt?.id ?? null,
          memberId: appt?.member_id ?? null,
          needsIntake: needsIntake && !!appt?.id && !intakeSaved,
        });
      }
    } catch (error: any) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to book appointment");
    }
  };

  const minDate = isSameDayEligible ? startOfDay(new Date()) : addDays(new Date(), 1);
  const maxDate = addMonths(new Date(), 3);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {confirmation ? (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Booking Confirmed</DialogTitle>
              <DialogDescription className="sr-only">
                Your {confirmation.serviceName} booking is confirmed.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-semibold mb-1">Booking Confirmed</h2>
              <p className="text-sm text-muted-foreground mb-6">
                We've added this to your schedule.
              </p>

              <div className="w-full max-w-md border rounded-lg divide-y">
                <div className="px-4 py-3 flex justify-between items-start gap-4">
                  <span className="text-sm text-muted-foreground">Service</span>
                  <span className="text-sm font-medium text-right">{confirmation.serviceName}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-start gap-4">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm font-medium text-right">
                    {format(confirmation.date, "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between items-start gap-4">
                  <span className="text-sm text-muted-foreground">Time</span>
                  <span className="text-sm font-medium text-right">
                    {formatTime12h(confirmation.time)} · {confirmation.durationMinutes} min
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between items-start gap-4">
                  <span className="text-sm text-muted-foreground">Payment</span>
                  <span className="text-sm font-medium text-right">{confirmation.paymentSummary}</span>
                </div>
              </div>

              {confirmation.needsIntake && confirmation.appointmentId && (
                <div className="w-full mt-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-left">
                  <div className="flex items-start gap-3 mb-4">
                    <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Complete your intake form</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Please fill this out now so your therapist can prepare. Takes about a minute.
                      </p>
                    </div>
                  </div>
                  <InlineIntakeForm
                    appointmentId={confirmation.appointmentId}
                    memberId={confirmation.memberId ?? null}
                    onDone={() => {
                      setConfirmation((c) => c ? { ...c, needsIntake: false } : c);
                      toast.success("Intake form saved");
                    }}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(membership ? "/member/wellness" : "/portal/bookings");
                  }}
                >
                  View My Appointments
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>

        ) : step === "intake" && needsIntake ? (
          <>
            <DialogHeader>
              <DialogTitle>Intake Form — {service.name}</DialogTitle>
              <DialogDescription>
                Last step. Share a few details so your therapist can tailor your session.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-2 -ml-2"
                onClick={() => setStep("details")}
                disabled={bookAppointment.isPending || submitIntake.isPending}
              >
                ← Back to booking details
              </Button>
              <SpaIntakeForm
                showHeader={false}
                isSubmitting={bookAppointment.isPending || submitIntake.isPending}
                submitLabel={
                  usingVoucher
                    ? "Confirm & Book with Voucher"
                    : paymentMethod === "credit"
                    ? "Confirm & Book with Credit"
                    : `Confirm & Book $${(paymentMethod === "card"
                        ? finalPrice + calculateProcessingFeeFromDollars(finalPrice)
                        : finalPrice
                      ).toFixed(2)}`
                }
                onSubmit={async (values) => {
                  await handleBook(values);
                }}
              />
            </div>
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>Book {service.name}</DialogTitle>
          <DialogDescription>
            Select your preferred date and time for this {service.duration_minutes} min service.
          </DialogDescription>
        </DialogHeader>


        <div className="space-y-6 py-4">
          {/* Service Details */}
          <div className="p-4 bg-secondary/50 rounded-md">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">{service.name}</h4>
                <p className="text-sm text-muted-foreground">{service.category}</p>
              </div>
              <div className="text-right">
                {paymentMethod === "credit" ? (
                  <>
                    <p className="text-sm text-muted-foreground line-through">${service.price.toFixed(2)}</p>
                    <p className="text-lg font-semibold text-accent">FREE</p>
                    <p className="text-xs text-muted-foreground">Using Member Credit</p>
                  </>
                ) : membership && finalPrice < service.price ? (
                  <>
                    <p className="text-sm text-muted-foreground line-through">${service.price.toFixed(2)}</p>
                    <p className="text-lg font-semibold text-accent">${finalPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Member Price</p>
                  </>
                ) : (
                  <p className="text-lg font-semibold">${service.price.toFixed(2)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {service.duration_minutes} min
              </span>
              <span className="text-xs">+ {service.cleanup_minutes} min cleanup</span>
            </div>
          </div>

          {/* Liability Waiver */}
          {user && !hasLiabilityWaiver && (
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
                      id="spa-waiver-inline"
                      checked={waiverAcknowledged}
                      onCheckedChange={(v) => setWaiverAcknowledged(v === true)}
                    />
                    <label
                      htmlFor="spa-waiver-inline"
                      className="text-sm leading-snug cursor-pointer"
                    >
                      I have reviewed the Liability Waiver and agree to its terms
                    </label>
                  </div>

                  <Button
                    onClick={handleSignWaiverInline}
                    disabled={!waiverAcknowledged || isSigningWaiver || isSigningNonMemberWaiver}
                    className="w-full"
                  >
                    {(isSigningWaiver || isSigningNonMemberWaiver) ? (
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

          {(!user || hasLiabilityWaiver) && (<>
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => {
                    if (date < minDate || date > maxDate) return true;
                    // Disable dates with no therapist coverage for this service
                    return !hasCoverageOnDate(availability, service.id, date);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {windowHint && (
              <p className="text-xs text-muted-foreground">
                Available: {formatTime12h(windowHint.start)} – {formatTime12h(windowHint.end)} (last booking {formatTime12h(windowHint.latestStart)})
              </p>
            )}
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <Label>Select Time</Label>
              {!coverageOnDate ? (
                <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium">
                    No appointments available on {format(selectedDate, "EEEE, MMMM d")}.
                  </p>
                  {nextAvailable ? (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => {
                        setSelectedDate(nextAvailable.date);
                        setSelectedTime(nextAvailable.time);
                      }}
                    >
                      <span>
                        Next available: {format(nextAvailable.date, "EEEE, MMM d")} at {formatTime12h(nextAvailable.time)}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No availability found in the next 60 days. Please contact the front desk.
                    </p>
                  )}
                </div>
              ) : availableStartTimes.length === 0 ? (
                <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-medium">
                    No openings on {format(selectedDate, "EEEE, MMMM d")} that fit this service.
                  </p>
                  {nextAvailable && (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => {
                        setSelectedDate(nextAvailable.date);
                        setSelectedTime(nextAvailable.time);
                      }}
                    >
                      <span>
                        Next available: {format(nextAvailable.date, "EEEE, MMM d")} at {formatTime12h(nextAvailable.time)}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {availableStartTimes.map((time) => {
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={cn(
                          "px-3 py-2 text-sm rounded-md border transition-colors",
                          isSelected && "bg-accent text-accent-foreground border-accent",
                          !isSelected && "hover:bg-secondary border-border"
                        )}
                      >
                        {formatTime12h(time)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mother's Day Voucher */}
          <div className="rounded-md border p-3 space-y-2" style={{ borderColor: "#c9a86a", background: "#fdfaf3" }}>
            <Label className="flex items-center gap-2 text-sm" style={{ color: "#a17e3a" }}>
              <Heart className="h-4 w-4" /> Mother's Day Voucher
            </Label>
            {appliedVoucher ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded bg-emerald-50 border border-emerald-200">
                <div className="text-sm">
                  <div className="font-medium text-emerald-900">{appliedVoucher.code} applied · $0 due</div>
                  <div className="text-xs text-emerald-700">
                    {appliedVoucher.massage_choice} · {appliedVoucher.massage_duration} min · prepaid
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { clearVoucher(); setVoucherInput(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="MOM-XXXXXX"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    className="font-mono tracking-wider"
                  />
                  <Button size="sm" onClick={handleApplyVoucher} disabled={applyingVoucher || !voucherInput.trim()}>
                    {applyingVoucher ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {voucherError && (
                  <p className="text-xs text-destructive">{voucherError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Have a Mother's Day code? Enter it to skip payment.
                </p>
              </>
            )}
          </div>

          {/* Payment Method */}
          {!usingVoucher && (
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(value: PaymentMethodType) => setPaymentMethod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canUseCredit && creditType && (
                  <SelectItem value="credit">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      Use {getCreditTypeDisplayName(creditType)} Credit ({availableCredit?.credits_remaining} remaining)
                    </div>
                  </SelectItem>
                )}
                <SelectItem value="card">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Credit/Debit Card
                  </div>
                </SelectItem>
                {membership && (
                  <SelectItem value="member_account">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Charge to Member Account
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          )}

          {!usingVoucher && paymentMethod === "credit" && availableCredit && creditType && (
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-md">
              <div className="flex items-center gap-2 text-accent">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">Using Member Credit</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                1 {getCreditTypeDisplayName(creditType)} credit will be deducted.
                You have {availableCredit.credits_remaining} credit{availableCredit.credits_remaining > 1 ? "s" : ""} remaining.
              </p>
            </div>
          )}

          {!usingVoucher && paymentMethod === "card" && savedPaymentMethods.length > 0 && (
            <div className="space-y-2">
              <Label>Select Card</Label>
              <Select value={selectedPaymentMethodId || ""} onValueChange={setSelectedPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a card" />
                </SelectTrigger>
                <SelectContent>
                  {savedPaymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.card?.brand?.toUpperCase()} •••• {pm.card?.last4} (Expires {pm.card?.exp_month}/{pm.card?.exp_year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Member Notes */}
          <div className="space-y-2">
            <Label>Special Requests or Notes (Optional)</Label>
            <Textarea
              placeholder="Any preferences, concerns, or special requests..."
              value={memberNotes}
              onChange={(e) => setMemberNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Total */}
          <div className="border-t pt-4 space-y-1">
            {usingVoucher ? (
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span className="text-accent">FREE (Mother's Day Voucher)</span>
              </div>
            ) : paymentMethod === "credit" ? (
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span className="text-accent">FREE (1 Credit)</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>Service</span>
                  <span>${finalPrice.toFixed(2)}</span>
                </div>
                {paymentMethod === "card" && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Processing Fee</span>
                    <span>+${calculateProcessingFeeFromDollars(finalPrice).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-accent">
                    ${paymentMethod === "card"
                      ? (finalPrice + calculateProcessingFeeFromDollars(finalPrice)).toFixed(2)
                      : finalPrice.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
          </>)}
        </div>

        {user && !phoneLoading && !hasPhone && (
          <div className="mt-2">
            <PhoneRequiredGate reason="We use it for spa appointment reminders and last-minute schedule changes. Required to book." />
          </div>
        )}
        <div className="flex gap-2 justify-end">

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (needsIntake) {
                // Validate prerequisites before advancing to intake step
                if (!selectedDate || !selectedTime) {
                  toast.error("Please select a date and time");
                  return;
                }
                if (
                  !usingVoucher &&
                  paymentMethod === "card" &&
                  !selectedPaymentMethodId &&
                  savedPaymentMethods.length > 0
                ) {
                  toast.error("Please select a payment method");
                  return;
                }
                setStep("intake");
                return;
              }
              void handleBook();
            }}
            disabled={
              !selectedDate ||
              !selectedTime ||
              bookAppointment.isPending ||
              (!usingVoucher && paymentMethod === "card" && !selectedPaymentMethodId && savedPaymentMethods.length > 0)
            }
          >
            {bookAppointment.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Booking...
              </>
            ) : needsIntake ? (
              <>Continue to Intake <ArrowRight className="w-4 h-4 ml-2" /></>
            ) : usingVoucher ? (
              "Book with Voucher"
            ) : paymentMethod === "credit" ? (
              "Book with Credit"
            ) : (
              `Book for $${finalPrice.toFixed(2)}`
            )}
          </Button>
        </div>

        </>
        )}
      </DialogContent>
    </Dialog>

    <IntakeFormDialog
      open={intakeOpen}
      onOpenChange={setIntakeOpen}
      appointmentId={intakeAppointmentId}
      memberId={intakeMemberId}
      serviceName={service?.name}
    />
    </>
  );
}

function InlineIntakeForm({
  appointmentId,
  memberId,
  onDone,
}: {
  appointmentId: string;
  memberId: string | null;
  onDone: () => void;
}) {
  const { data: existing } = useIntakeForm(appointmentId);
  const submit = useSubmitIntakeForm();
  return (
    <SpaIntakeForm
      initial={existing}
      isSubmitting={submit.isPending}
      submitLabel={existing ? "Update Intake Form" : "Submit Intake Form"}
      showHeader={false}
      onSubmit={async (values) => {
        await submit.mutateAsync({
          ...values,
          appointment_id: appointmentId,
          member_id: memberId,
        });
        onDone();
      }}
    />
  );
}
