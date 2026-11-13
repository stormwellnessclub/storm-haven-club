import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { SpaEditorial } from "@/components/spa-preview/SpaEditorial";
import { useHashScroll } from "@/hooks/useHashScroll";
import { spaMenuMode } from "@/lib/spaMenu";
import { SPA_GOOD_TO_KNOW_TIERS, chapterForCategory } from "@/lib/spaPage";
import { ShieldCheck, CreditCard, ExternalLink } from "lucide-react";
import { RedeemVoucherDialog } from "@/components/spa/RedeemVoucherDialog";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SpaBookingModal } from "@/components/booking/SpaBookingModal";
import { IntakeFormDialog } from "@/components/spa/IntakeFormDialog";
import { useSpaServices, type SpaService } from "@/hooks/useSpaManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useAllAgreements } from "@/hooks/useAllAgreements";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { SpaReviewsTab } from "@/components/spa/SpaReviewsTab";
import { useSpaServiceRatings } from "@/hooks/useSpaReviews";
import { buildServiceLd } from "@/lib/seo/schemas";
import { GuestSpaFollowUp } from "@/components/spa/GuestSpaFollowUp";
import { readGuestCheckoutAccess } from "@/lib/spaGuestCheckout";

// Body wraps that clients book themselves (waiver + card gates, wrap intake after booking).
// Active wraps use direct booking; availability controls launch dates.

const memberDiscounts = [
  { tier: "Silver", discount: "5% OFF", color: "bg-warm-gray" },
  { tier: "Gold", discount: "8% OFF", color: "bg-gold" },
  { tier: "Platinum", discount: "10% OFF", color: "bg-muted" },
  { tier: "Diamond", discount: "12% OFF", color: "bg-accent" },
];

export default function Spa() {
  const [guestReturn, setGuestReturn] = useState(readGuestCheckoutAccess);
  const { data: dbServices, isLoading: servicesLoading } = useSpaServices();
  // Preview-only treatments (public_menu = false) stay off the live menu until launch.
  const spaServices = (dbServices || []).filter(s => s.is_active && (s as { public_menu?: boolean }).public_menu !== false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  const voucherFromUrl = searchParams.get("voucher");
  const tabFromUrl = searchParams.get("view");
  const [view, setView] = useState<"services" | "reviews">(tabFromUrl === "reviews" ? "reviews" : "services");
  const { data: serviceRatings = {} } = useSpaServiceRatings();
  const [selectedService, setSelectedService] = useState<SpaService | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeVoucherCode, setActiveVoucherCode] = useState<string | null>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  // Post-booking intake form (owned by page so it survives the booking modal closing)
  const [intakeInfo, setIntakeInfo] = useState<{ appointmentId: string; memberId: string | null; serviceName: string } | null>(null);

  // Gate states
  const [showWaiverGate, setShowWaiverGate] = useState(false);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [pendingMassageService, setPendingMassageService] = useState<SpaService | null>(null);

  // Request modal states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestService, setRequestService] = useState<SpaService | null>(null);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("");
  const [requestAltDate, setRequestAltDate] = useState("");
  const [requestAltTime, setRequestAltTime] = useState("");
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
  const [requestMessage, setRequestMessage] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Hooks for gate checks
  const { profile: memberProfile, signWaiver, isSigningWaiver } = useUserProfile();
  const { profile: nonMemberProfile, signWaiver: signNonMemberWaiver, isSigningWaiver: isSigningNonMemberWaiver } = useNonMemberProfile();
  const { data: membership } = useUserMembership();
  const { data: agreements } = useAllAgreements();

  useHashScroll();

  // ?category=Facials (older links and the category pages) → open that chapter of the page.
  useEffect(() => {
    if (!categoryFromUrl || servicesLoading) return;
    const id = chapterForCategory(categoryFromUrl);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [categoryFromUrl, servicesLoading]);

  // ?view=reviews → open the client reviews.
  useEffect(() => {
    if (tabFromUrl !== "reviews") return;
    setView("reviews");
    setTimeout(() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [tabFromUrl]);

  // ?request=<treatment name> (facial pages, older links) → open the appointment request form.
  const requestFromUrl = searchParams.get("request");
  const handledRequestRef = useRef(false);
  useEffect(() => {
    if (handledRequestRef.current || !requestFromUrl || servicesLoading) return;
    const svc = spaServices.find((s) => s.name === requestFromUrl) ?? spaServices.find((s) => s.category === requestFromUrl);
    if (!svc) return;
    handledRequestRef.current = true;
    handleRequestService(svc);
    const next = new URLSearchParams(searchParams);
    next.delete("request");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFromUrl, servicesLoading, spaServices]);

  // ?voucher=MOM-XXXXXX → look up voucher, open booking modal pre-filled with matching massage service
  useEffect(() => {
    if (!voucherFromUrl || spaServices.length === 0 || activeVoucherCode) return;
    const code = voucherFromUrl.trim().toUpperCase();
    (async () => {
      const { data, error } = await supabase.rpc("lookup_mothers_day_voucher", { p_code: code });
      const v = data as any;
      if (error || !v?.found) {
        toast.error("Voucher code not found");
        return;
      }
      // Pick a Massage service matching the voucher's duration
      const massage = spaServices.find(
        (s) => (s.category || "").toLowerCase().includes("massage") &&
          s.duration_minutes === v.massage_duration
      ) || spaServices.find((s) => (s.category || "").toLowerCase().includes("massage"));
      if (!massage) {
        toast.error("No massage service available to redeem this voucher");
        return;
      }
      setActiveVoucherCode(code);
      setSelectedService(massage);
      setShowBookingModal(true);
    })();
  }, [voucherFromUrl, spaServices, activeVoucherCode]);

  useEffect(() => {
    if (searchParams.get("service") === "detox-seaweed-charcoal" && !servicesLoading) {
      document.getElementById("body")?.scrollIntoView({ block: "start" });
    }
  }, [searchParams, servicesLoading]);

  // Returning from sign-in with a chosen treatment: reopen its booking.
  const resumedBookRef = useRef(false);
  const bookFromUrl = searchParams.get("book");
  useEffect(() => {
    if (resumedBookRef.current || !bookFromUrl || !user || servicesLoading) return;
    if (!memberProfile && !nonMemberProfile) return; // wait for waiver/card info
    const svc = spaServices.find((s) => s.id === bookFromUrl);
    if (!svc) return;
    resumedBookRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("book");
    setSearchParams(next, { replace: true });
    if (svc.category === "Recovery") {
      setSelectedService(svc);
      setShowBookingModal(true);
    } else {
      handleMassageBooking(svc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookFromUrl, user, servicesLoading, spaServices, memberProfile, nonMemberProfile]);

  // Determine if user is a member or non-member
  const isMember = !!membership;

  // Check waiver status across both profile tables
  const isWaiverSigned = isMember
    ? !!memberProfile?.waiver_signed
    : !!nonMemberProfile?.waiver_signed;

  // Check payment on file
  const hasPaymentOnFile = isMember
    ? !!(membership?.stripe_customer_id && membership?.card_last4)
    : !!(nonMemberProfile?.stripe_customer_id && nonMemberProfile?.card_last4);

  // Get waiver PDF URL
  const waiverAgreements = agreements?.liability_waiver || [];
  const waiverPdfUrl = waiverAgreements.length > 0 ? waiverAgreements[0].pdf_url : null;

  // Handle "Book Now" for Massage category
  const handleMassageBooking = (service: SpaService) => {
    // Show open times first; the booking window asks for the waiver and a
    // card on file only after a time is picked.
    window.__lovableEvents?.track?.("project.spa_book_click", { category: service.category ?? "unknown" });
    setSelectedService(service);
    setShowBookingModal(true);
    setPendingMassageService(null);
  };

  // After waiver is signed, proceed to payment gate check
  const handleWaiverSign = () => {
    if (isMember) {
      signWaiver(undefined, {
        onSuccess: () => {
          setShowWaiverGate(false);
          // Now check payment gate
          if (!hasPaymentOnFile) {
            setShowPaymentGate(true);
          } else if (pendingMassageService) {
            setSelectedService(pendingMassageService);
            setShowBookingModal(true);
            setPendingMassageService(null);
          }
        },
      });
    } else {
      signNonMemberWaiver(undefined, {
        onSuccess: () => {
          setShowWaiverGate(false);
          if (!hasPaymentOnFile) {
            setShowPaymentGate(true);
          } else if (pendingMassageService) {
            setSelectedService(pendingMassageService);
            setShowBookingModal(true);
            setPendingMassageService(null);
          }
        },
      });
    }
  };

  // Services that require a phone consultation before we can confirm a time
  const isConsultRequestService = (service: SpaService) => /ozone/i.test(service.name);

  // Handle "Request" for non-Massage/non-Recovery categories
  const handleRequestService = (service: SpaService) => {
    setRequestService(service);
    setRequestName(user?.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
      : memberProfile?.first_name
        ? `${memberProfile.first_name} ${memberProfile.last_name || ""}`.trim()
        : "");
    setRequestEmail(user?.email || "");
    setRequestPhone(memberProfile?.phone || (user?.user_metadata?.phone as string) || "");
    setRequestDate("");
    setRequestTime("");
    setRequestAltDate("");
    setRequestAltTime("");
    setRequestMessage(`I'm interested in booking: ${service.name}`);
    setShowRequestModal(true);
  };

  const requiresPhone = requestService ? isConsultRequestService(requestService) : false;

  const handleSubmitRequest = async () => {
    if (!requestName.trim() || !requestEmail.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }
    if (requiresPhone && requestPhone.trim().length < 7) {
      toast.error("Please enter a phone number — we need to call you before this appointment.");
      return;
    }
    if (!requestDate || !requestTime) {
      toast.error("Please pick the day and time you'd like.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const { error } = await supabase.from("spa_service_requests").insert({
        name: requestName.trim(),
        email: requestEmail.trim(),
        phone: requestPhone.trim() || null,
        preferred_time: null,
        requested_date: requestDate,
        requested_time: requestTime,
        alt_date: requestAltDate || null,
        alt_time: requestAltDate && requestAltTime ? requestAltTime : null,
        service_name: requestService?.name || "",
        service_category: requestService?.category || "",
        message: requestMessage.trim() || null,
      } as any);

      if (error) throw error;

      toast.success(
        requiresPhone
          ? "Request received — we'll call you to confirm your appointment."
          : "We'll be in touch soon!"
      );
      setShowRequestModal(false);
      setRequestService(null);
    } catch (err: any) {
      toast.error("Failed to submit request: " + err.message);
    } finally {
      setIsSubmittingRequest(false);
    }
  };


  // One entry point for the page's Book buttons: request-only treatments open the request form.
  const handleBook = (service: SpaService) => {
    if (spaMenuMode(service) === "request") return handleRequestService(service);
    if (service.category === "Recovery") {
      window.__lovableEvents?.track?.("project.spa_book_click", { category: service.category });
      setSelectedService(service);
      setShowBookingModal(true);
      return;
    }
    handleMassageBooking(service);
  };
  const openReviews = () => {
    setView("reviews");
    setTimeout(() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <Layout>
      <SEOHead
        title="Recovery Spa & Massage Livonia, MI | Aella at Storm"
        description="Recovery spa in Livonia, MI open to the public — no membership needed. Himalayan salt room, infrared sauna, red light therapy, cold plunge, cryotherapy and massage."
        path="/spa"
        image="/og/og-spa.jpg"
        imageAlt="Aella Massage & Recovery Spa at Storm Wellness Club in Livonia, Michigan"
        jsonLd={buildServiceLd({
          name: "Aella Massage & Recovery Spa",
          serviceType: "Day Spa",
          description:
            "Massage therapy, body wraps, facials and recovery (salt room, infrared sauna, red light, cold plunge, cryotherapy) in Livonia, MI. Open to the public.",
          path: "/spa",
        })}
      />

      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://stormwellnessclub.com" },
            { "@type": "ListItem", position: 2, name: "Recovery Spa", item: "https://stormwellnessclub.com/spa" },
          ],
        })}</script>
      </Helmet>

      {/* Hidden SEO H1 — keyword-anchored, not visible to users */}
      <h1 className="sr-only">Recovery Spa &amp; Massage in Livonia, MI — Aella at Storm Wellness Club, open to the public</h1>

      {/* Hidden SEO intro — crawlable copy naming every modality and the service area */}
      <section className="sr-only" aria-hidden="true">
        <h2>Recovery Spa Near Livonia, MI</h2>
        <p>
          Aella by Storm Wellness Club is a full recovery spa near Livonia, Michigan, featuring
          red light therapy, whole-body cryotherapy, infrared sauna, cold plunge, traditional sauna
          and steam room, salt room halotherapy, Starpool ZeroBody dry float, and licensed
          therapeutic massage including Swedish, deep tissue, sports, and prenatal modalities.
          We serve the greater Detroit metro including Farmington Hills, Plymouth, Northville,
          Novi, Redford, Westland, Canton, Garden City, and Southfield.
        </p>
      </section>

      <SpaEditorial
        services={spaServices}
        onBook={handleBook}
        onRequest={handleRequestService}
        ratings={serviceRatings}
        onReviews={openReviews}
        extras={
          <>
            {/* Client reviews — in the flow of the page, opened on request */}
            <section id="reviews" className="scroll-mt-20 border-t border-foreground/10 px-6 py-20 md:px-16 md:py-28">
              <div className="max-w-4xl">
                <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">In their words</p>
                <h2 className="mt-4 font-serif text-4xl md:text-5xl">Client reviews</h2>
                {view === "reviews" ? (
                  <div className="mt-10"><SpaReviewsTab /></div>
                ) : (
                  <button type="button" onClick={() => setView("reviews")} className="mt-8 inline-block border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground">
                    Read Reviews
                  </button>
                )}
              </div>
            </section>

            {/* Good to know — member pricing, gift cards, body roller */}
            <section aria-label="Good to know" className="border-t border-foreground/10 px-6 py-20 md:px-16 md:py-28">
              <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">Good to know</p>
              <div className="mt-10 grid gap-14 md:grid-cols-3 md:gap-10">
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl">Member pricing</h3>
                  <ul className="mt-6">
                    {SPA_GOOD_TO_KNOW_TIERS.map((t) => (
                      <li key={t.tier} className="flex justify-between border-t border-foreground/15 py-3 text-sm">
                        <span>{t.tier}</span><span className="text-muted-foreground">{t.discount}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                    Member pricing does not apply to IV therapy, peptide therapy, injectable services, med-aesthetic treatments,
                    device-based body aesthetics, laser hair removal, retail products, packages/bundles or gift cards.
                  </p>
                </div>
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl">Gift cards &amp; vouchers</h3>
                  <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Give someone an hour at Aella, or use a voucher or gift card you've been given.</p>
                  <div className="mt-8 flex flex-col items-start gap-5">
                    <Link to="/shop#gift-cards" className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground">Give a Gift Card</Link>
                    <button type="button" onClick={() => setShowRedeemDialog(true)} className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground">Use a Voucher or Gift Card</button>
                    {activeVoucherCode && <p className="text-xs text-muted-foreground">Code {activeVoucherCode} is saved and will be applied when you book.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl">Lymphatic Body Roller</h3>
                  <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                    Warm, rhythmic compression across sculpted wooden rollers to encourage circulation, ease tension and leave the body lighter.
                  </p>
                  <div className="mt-8 flex flex-col items-start gap-5">
                    <Link to="/body-roller-presale" className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground">See Presale</Link>
                    <Link to="/journal/lymphatic-body-roller" className="border-b border-foreground/40 pb-1 text-xs tracking-[0.25em] uppercase text-foreground hover:border-foreground">Read About the Ritual</Link>
                  </div>
                </div>
              </div>
            </section>
          </>
        }
      />

      {/* Booking Modal */}
      <Dialog open={!!guestReturn} onOpenChange={(open) => { if (!open) setGuestReturn(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Your spa booking</DialogTitle><DialogDescription>Appointment confirmation and pre-visit forms</DialogDescription></DialogHeader>
          {guestReturn && <GuestSpaFollowUp access={guestReturn} onDone={() => {
            setGuestReturn(null);
            const next = new URLSearchParams(searchParams); next.delete('guestCheckout'); setSearchParams(next, {replace:true});
            window.history.replaceState(null, '', `${window.location.pathname}${next.size ? `?${next}` : ''}`);
          }} />}
        </DialogContent>
      </Dialog>
      <SpaBookingModal
        service={selectedService}
        open={showBookingModal}
        initialVoucherCode={activeVoucherCode}
        onIntakeRequired={(info) => setIntakeInfo(info)}
        onOpenChange={(open) => {
          setShowBookingModal(open);
          if (!open) {
            setSelectedService(null);
            if (activeVoucherCode) {
              setActiveVoucherCode(null);
              const next = new URLSearchParams(searchParams);
              next.delete("voucher");
              setSearchParams(next, { replace: true });
            }
          }
        }}
      />

      {/* Post-booking intake form (mounted at page level so it survives the booking modal closing) */}
      <IntakeFormDialog
        open={!!intakeInfo}
        onOpenChange={(open) => { if (!open) setIntakeInfo(null); }}
        appointmentId={intakeInfo?.appointmentId ?? null}
        memberId={intakeInfo?.memberId ?? null}
        serviceName={intakeInfo?.serviceName}
        onSubmitted={() => setIntakeInfo(null)}
      />


      {/* Generic voucher / gift card redemption */}
      <RedeemVoucherDialog
        open={showRedeemDialog}
        onOpenChange={setShowRedeemDialog}
        onGiftCard={(code) => {
          setActiveVoucherCode(code);
          toast.success("Gift card saved — choose your treatment and time, and it will be applied at checkout.");
        }}
        onResolved={(code, voucher) => {
          const massage =
            spaServices.find(
              (s) =>
                (s.category || "").toLowerCase().includes("massage") &&
                s.duration_minutes === voucher.massage_duration
            ) || spaServices.find((s) => (s.category || "").toLowerCase().includes("massage"));
          if (!massage) {
            toast.error("No massage service available to redeem this voucher");
            return;
          }
          setActiveVoucherCode(code);
          setSelectedService(massage);
          setShowBookingModal(true);
        }}
      />

      {/* ===== WAIVER GATE MODAL ===== */}
      <Dialog open={showWaiverGate} onOpenChange={(open) => {
        setShowWaiverGate(open);
        if (!open) {
          setWaiverAgreed(false);
          setPendingMassageService(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-gold" />
              Liability Waiver Required
            </DialogTitle>
            <DialogDescription>
              You must sign our liability waiver before booking a massage service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {waiverPdfUrl && (
              <a
                href={waiverPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View Liability Waiver (PDF)
              </a>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              By signing this waiver, you acknowledge that you have read, understood, and agree to 
              the terms of the liability waiver for spa services at Storm Wellness Club / Spa Aella. 
              You assume all risks associated with spa treatments and release the facility from liability.
            </p>
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="waiver-agree"
                checked={waiverAgreed}
                onCheckedChange={(checked) => setWaiverAgreed(checked === true)}
              />
              <label htmlFor="waiver-agree" className="text-sm font-medium leading-tight cursor-pointer">
                I have read and agree to the liability waiver
              </label>
            </div>
            <Button
              className="w-full"
              variant="gold"
              disabled={!waiverAgreed || isSigningWaiver || isSigningNonMemberWaiver}
              onClick={handleWaiverSign}
            >
              {(isSigningWaiver || isSigningNonMemberWaiver) ? "Signing…" : "Sign & Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== PAYMENT GATE MODAL ===== */}
      <Dialog open={showPaymentGate} onOpenChange={(open) => {
        setShowPaymentGate(open);
        if (!open) setPendingMassageService(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gold" />
              Payment Method Required
            </DialogTitle>
            <DialogDescription>
              A payment method on file is required before booking a massage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please add a credit or debit card to your account before proceeding. 
              Your card will be charged at the time of booking.
            </p>
            <Button
              className="w-full"
              variant="gold"
              onClick={() => {
                setShowPaymentGate(false);
                setPendingMassageService(null);
                navigate(isMember ? "/member/billing" : "/portal/billing");
              }}
            >
              Go to Billing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== SERVICE REQUEST MODAL ===== */}
      <Dialog open={showRequestModal} onOpenChange={(open) => {
        setShowRequestModal(open);
        if (!open) setRequestService(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{requiresPhone ? "Request an Appointment" : "Request a Service"}</DialogTitle>
            <DialogDescription>
              {requestService
                ? requiresPhone
                  ? `${requestService.name} is booked by phone — leave your name and number and we'll call you to go over everything and confirm a time.`
                  : `Inquire about ${requestService.name}. We'll reach out to schedule your appointment.`
                : "Tell us what you're interested in."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="req-name">Name</Label>
              <Input
                id="req-name"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-phone">Phone {requiresPhone && <span className="text-destructive">*</span>}</Label>
              <Input
                id="req-phone"
                type="tel"
                value={requestPhone}
                onChange={(e) => setRequestPhone(e.target.value)}
                placeholder="(313) 555-0123"
                maxLength={25}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-email">Email</Label>
              <Input
                id="req-email"
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="req-date">Day you'd like <span className="text-destructive">*</span></Label>
                <Input
                  id="req-date"
                  type="date"
                  min={todayStr}
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-time">Time <span className="text-destructive">*</span></Label>
                <Input
                  id="req-time"
                  type="time"
                  step={900}
                  value={requestTime}
                  onChange={(e) => setRequestTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="req-alt-date" className="text-muted-foreground">Second choice (optional)</Label>
                <Input
                  id="req-alt-date"
                  type="date"
                  min={todayStr}
                  value={requestAltDate}
                  onChange={(e) => setRequestAltDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-alt-time" className="text-muted-foreground">Time</Label>
                <Input
                  id="req-alt-time"
                  type="time"
                  step={900}
                  value={requestAltTime}
                  onChange={(e) => setRequestAltTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-message">Message</Label>
              <Textarea
                id="req-message"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell us about your interest…"
                rows={3}
                maxLength={1000}
              />
            </div>
            <Button
              className="w-full"
              variant="gold"
              disabled={
                isSubmittingRequest ||
                !requestName.trim() ||
                !requestEmail.trim() ||
                !requestDate ||
                !requestTime ||
                (requiresPhone && requestPhone.trim().length < 7)
              }
              onClick={handleSubmitRequest}
            >
              {isSubmittingRequest ? "Submitting…" : "Send Request"}
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
