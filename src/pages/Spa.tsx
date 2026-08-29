import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Clock, Star, Users, Info, ShieldCheck, CreditCard, ExternalLink, Loader2, Gift } from "lucide-react";
import { RedeemVoucherDialog } from "@/components/spa/RedeemVoucherDialog";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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

import sauna from "@/assets/sauna.jpg";
import spaShower from "@/assets/spa-shower.jpg";
import treatmentRoom from "@/assets/treatment-room.jpg";
import aellaLogo from "@/assets/aella-logo-mark.png";
// Wellness imagery
import saunaInterior from "@/assets/wellness/sauna-interior.jpg";
import fracturedIce from "@/assets/wellness/fractured-ice.jpg";
import { SpaReviewsTab } from "@/components/spa/SpaReviewsTab";

const categories = ["All", "Facials", "Massage", "Body Rituals", "Body Wraps", "Recovery"];

const memberDiscounts = [
  { tier: "Silver", discount: "5% OFF", color: "bg-warm-gray" },
  { tier: "Gold", discount: "8% OFF", color: "bg-gold" },
  { tier: "Platinum", discount: "10% OFF", color: "bg-muted" },
  { tier: "Diamond", discount: "12% OFF", color: "bg-accent" },
];

export default function Spa() {
  const { data: dbServices, isLoading: servicesLoading } = useSpaServices();
  const spaServices = (dbServices || []).filter(s => s.is_active);

  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  const voucherFromUrl = searchParams.get("voucher");
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl || "All");
  const tabFromUrl = searchParams.get("view");
  const [view, setView] = useState<"services" | "reviews">(tabFromUrl === "reviews" ? "reviews" : "services");
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
  const [requestPreferredTime, setRequestPreferredTime] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Hooks for gate checks
  const { profile: memberProfile, signWaiver, isSigningWaiver } = useUserProfile();
  const { profile: nonMemberProfile, signWaiver: signNonMemberWaiver, isSigningWaiver: isSigningNonMemberWaiver } = useNonMemberProfile();
  const { data: membership } = useUserMembership();
  const { data: agreements } = useAllAgreements();

  useEffect(() => {
    if (categoryFromUrl && categories.includes(categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

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

  const filteredServices = selectedCategory === "All" 
    ? spaServices 
    : spaServices.filter(s => s.category === selectedCategory);

  const formatPrice = (price: number) => `$${price}`;

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
    if (!user) {
      navigate(`/auth?returnTo=${encodeURIComponent("/spa?category=Massage")}`);
      return;
    }

    setPendingMassageService(service);

    // Gate 1: Waiver
    if (!isWaiverSigned) {
      setWaiverAgreed(false);
      setShowWaiverGate(true);
      return;
    }

    // Gate 2: Payment
    if (!hasPaymentOnFile) {
      setShowPaymentGate(true);
      return;
    }

    // Both gates passed — open booking
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
    setRequestPreferredTime("");
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

    setIsSubmittingRequest(true);
    try {
      const { error } = await supabase.from("spa_service_requests").insert({
        name: requestName.trim(),
        email: requestEmail.trim(),
        phone: requestPhone.trim() || null,
        preferred_time: requestPreferredTime.trim() || null,
        service_name: requestService?.name || "",
        service_category: requestService?.category || "",
        message: requestMessage.trim() || null,
      });

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


  // Render button per service category
  const renderServiceButton = (service: SpaService) => {
    if (isConsultRequestService(service)) {
      return (
        <Button variant="outline" size="sm" onClick={() => handleRequestService(service)}>
          Request Appointment
        </Button>
      );
    }

    if (service.category === "Recovery") {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!user) {
              navigate("/auth");
              return;
            }
            setSelectedService(service);
            setShowBookingModal(true);
          }}
        >
          Book Now
        </Button>
      );
    }

    if (service.category === "Massage") {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleMassageBooking(service)}
        >
          Book Now
        </Button>
      );
    }

    // All other categories: Coming Soon badge
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-wider bg-muted text-muted-foreground">
        Coming Soon
      </span>
    );
  };

  return (
    <Layout>
      <SEOHead
        title="Recovery Spa & Massage Livonia, MI | Aella at Storm"
        description="Recovery spa in Livonia, MI open to the public — no membership needed. Himalayan salt room, infrared sauna, red light therapy, cold plunge, cryotherapy and massage."
        path="/spa"
        image="/og/og-spa.jpg"
        imageAlt="Aella Massage & Recovery Spa at Storm Wellness Club in Livonia, Michigan"
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
      {/* Hero */}
      <section className="relative pt-20 min-h-[70vh] flex items-center">
        <div className="absolute inset-0">
          <img src={treatmentRoom} alt="Aella Recovery Spa treatment room at Storm Wellness Club in Livonia, MI" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/40" />
        </div>
        <div className="relative z-10 container mx-auto px-6 py-24">
          <div className="max-w-xl">
            <img src={aellaLogo} alt="Aella" className="h-24 w-auto mb-6" />
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">by Storm Wellness Club</p>
            <h2 className="heading-display text-primary-foreground mb-6">
              Recovery Spa &amp; Massage in Livonia
            </h2>
            <p className="text-primary-foreground/80 text-lg leading-relaxed mb-8">
              Open to the public — no membership required. Himalayan salt room, infrared sauna,
              red light therapy, cold plunge, cryotherapy and licensed massage are available to
              book today.
            </p>
            <Button variant="gold" size="lg">
              Book a Treatment
            </Button>
          </div>
        </div>
      </section>

      {/* Spa Aella Opening Notice */}
      <section className="py-4 bg-accent/10 border-b border-accent/20">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-center gap-3 text-center">
            <Info className="w-5 h-5 text-accent flex-shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Recovery services — salt room, infrared sauna, red light, cold plunge, cryotherapy and
              massage — are open now to members and non-members. Additional facial and body treatments
              marked "Coming Soon" are still on the way.
            </p>
          </div>
        </div>
      </section>


      {/* Member Discounts Banner */}
      <section className="py-6 bg-secondary/50 border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Member Spa Discounts:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {memberDiscounts.map((item) => (
                <div key={item.tier} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm">
                    <span className="font-medium">{item.tier}:</span> {item.discount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services / Reviews tab */}
      <section className="py-6 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <div className="inline-flex rounded-full border border-border p-1 bg-card">
            <button
              type="button"
              onClick={() => setView("services")}
              className={`px-5 py-2 text-sm rounded-full transition-colors ${
                view === "services" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => setView("reviews")}
              className={`px-5 py-2 text-sm rounded-full transition-colors ${
                view === "reviews" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Reviews
            </button>
          </div>
        </div>
      </section>

      {view === "reviews" ? (
        <section className="py-12 bg-background">
          <div className="container mx-auto px-6 max-w-4xl">
            <SpaReviewsTab />
          </div>
        </section>
      ) : (
      <>
      {/* Category Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`filter-badge ${selectedCategory === category ? "filter-badge-active" : ""}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowRedeemDialog(true)}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 hover:underline whitespace-nowrap"
            >
              <Gift className="w-4 h-4" />
              Have a voucher or gift card? Redeem
            </button>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          {servicesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No services available in this category yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="card-luxury p-6 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif text-xl">{service.name}</h3>
                        {service.popular && (
                          <span className="flex items-center gap-1 text-xs text-gold">
                            <Star className="w-3 h-3 fill-current" /> Popular
                          </span>
                        )}
                      </div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {service.category}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-sm mb-4 flex-1">
                    {service.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {service.duration_minutes} min
                      </span>
                      <div className="flex flex-col">
                        <span className="text-gold font-semibold text-lg">
                          {formatPrice(service.price)}
                        </span>
                        {service.member_price && (
                          <span className="text-xs text-muted-foreground">
                            Members: {formatPrice(service.member_price)}
                          </span>
                        )}
                      </div>
                    </div>
                    {renderServiceButton(service)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      </>
      )}


      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Our Treatment Spaces"
            subtitle="Experience tranquility in our thoughtfully designed treatment rooms."
          />
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="card-luxury p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-serif text-gold">5</span>
              </div>
              <h3 className="font-serif text-lg mb-2">Treatment Rooms</h3>
              <p className="text-sm text-muted-foreground">
                Thoughtfully designed spaces for your wellness journey
              </p>
            </div>
            
            <div className="card-luxury p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-serif text-gold">3</span>
              </div>
              <h3 className="font-serif text-lg mb-2">Shared Treatment Rooms</h3>
              <p className="text-sm text-muted-foreground">
                For facials, massage, and body ritual services
              </p>
            </div>
            
            <div className="card-luxury p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-serif text-gold">2</span>
              </div>
              <h3 className="font-serif text-lg mb-2">Dedicated Body Wrap Rooms</h3>
              <p className="text-sm text-muted-foreground">
                Specialized for body wrap services with waterproofing & sanitation
              </p>
            </div>
          </div>

          {/* Discount Exclusions Notice */}
          <div className="card-luxury p-6 mb-12">
            <div className="flex items-start gap-4">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium mb-2">Member Discount Exclusions</h4>
                <p className="text-sm text-muted-foreground">
                  Discounts do not apply to: IV Therapy, Peptide Therapy, Injectable Services, Med-Aesthetic Treatments, 
                  Device-Based Body Aesthetics, Laser Hair Removal, Retail Products, Packages/Bundles, or Gift Cards.
                </p>
              </div>
            </div>
          </div>

          {/* Gallery */}
          <div className="grid md:grid-cols-3 gap-6">
            <img src={sauna} alt="Sauna" className="rounded-sm h-64 w-full object-cover" />
            <img src={spaShower} alt="Spa Shower" className="rounded-sm h-64 w-full object-cover" />
            <img src={treatmentRoom} alt="Treatment Room" className="rounded-sm h-64 w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Booking Modal */}
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
        onResolved={(code, voucher) => {
          if (!user) {
            toast.error("Please sign in to redeem your voucher");
            navigate(`/auth?redirect=${encodeURIComponent(`/spa?voucher=${code}`)}`);
            return;
          }
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
            <div className="space-y-2">
              <Label htmlFor="req-preferred">Preferred day & time</Label>
              <Input
                id="req-preferred"
                value={requestPreferredTime}
                onChange={(e) => setRequestPreferredTime(e.target.value)}
                placeholder="e.g. Saturday afternoon"
                maxLength={120}
              />
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
