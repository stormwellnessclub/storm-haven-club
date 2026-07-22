import { useState, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { buildBreadcrumbLd, buildProductLd, buildFAQLd } from "@/lib/seo/schemas";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Check, Info, Clock, Loader2, ShoppingCart, FileText } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { toast } from "sonner";
import { AccountRequiredSection } from "@/components/AccountRequiredSection";
import { SimpleAgreementCard, DocumentInfo } from "@/components/SimpleAgreementCard";
import { useQueryClient } from "@tanstack/react-query";
import { useUserCredits } from "@/hooks/useUserCredits";
import { ClassPassPurchaseSuccessDialog } from "@/components/class-passes/ClassPassPurchaseSuccessDialog";
import { useClassPassPricing, findPrice } from "@/hooks/useClassPassPricing";


interface PricingTier {
  type: string;
  passType: 'single' | 'tenPack';
  memberPrice: number;
  nonMemberPrice: number;
}

// Default fallback used only if the pricing table hasn't loaded yet.
const FALLBACK_CLASS_PASS_PRICING: PricingTier[] = [
  { type: "Single Class", passType: 'single', memberPrice: 25, nonMemberPrice: 30 },
  { type: "10 Class Pack", passType: 'tenPack', memberPrice: 170, nonMemberPrice: 285 },
];

// Inline waiver signing prompt shown when user tries to purchase without signing
function InlineWaiverPrompt({ 
  agreementType, 
  title, 
  onSigned 
}: { 
  agreementType: string; 
  title: string;
  onSigned: () => void;
}) {
  const { data: agreements, isLoading } = useAgreements(agreementType);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileHook = useUserProfile();
  const nonMemberHook = useNonMemberProfile();

  // For liability_waiver, use non-member sign function if user has no member profile
  const hasProfile = !!profileHook.profile;

  // Map agreement type to the correct sign function/pending state
  const signerMap: Record<string, { sign: (vars: any, opts: any) => void; isPending: boolean }> = {
    single_class_pass: { sign: profileHook.signSingleClassPassAgreement, isPending: profileHook.isSigningSingleClassPassAgreement },
    class_package: { sign: profileHook.signClassPackageAgreement, isPending: profileHook.isSigningClassPackageAgreement },
    liability_waiver: hasProfile
      ? { sign: profileHook.signWaiver, isPending: profileHook.isSigningWaiver }
      : { sign: nonMemberHook.signWaiver, isPending: nonMemberHook.isSigningWaiver },
  };

  const signer = signerMap[agreementType];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agreements || agreements.length === 0 || !signer) return null;

  const documents: DocumentInfo[] = agreements.map(a => ({
    name: a.title,
    url: a.pdf_url || `${agreementType}.pdf`,
  }));

  const handleSign = () => {
    signer.sign(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
        queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
        toast.success(`${title} signed successfully!`);
        onSigned();
      },
    });
  };

  return (
    <div className="max-w-lg mx-auto my-8 card-luxury p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h3 className="font-serif text-lg">Agreement Required</h3>
          <p className="text-sm text-muted-foreground">Please sign before purchasing</p>
        </div>
      </div>
      <SimpleAgreementCard
        title={title}
        description={`Please review and sign the ${title} to continue with your purchase.`}
        documents={documents}
        onSign={handleSign}
        isSigning={signer.isPending}
        required
      />
    </div>
  );
}

// Extracted pricing tables component
function ClassPassPricingTables({ onPurchase, loadingPass, isMember, user }: {
  onPurchase: (category: 'pilatesCycling', passType: 'single' | 'tenPack') => void;
  loadingPass: string | null;
  isMember: boolean;
  user: any;
}) {
  const PurchaseButton = ({ 
    category, 
    passType, 
    price 
  }: { 
    category: 'pilatesCycling';
    passType: 'single' | 'tenPack';
    price: number;
  }) => {
    const passKey = `${category}-${passType}`;
    const isLoading = loadingPass === passKey;

    return (
      <Button
        size="sm"
        onClick={() => onPurchase(category, passType)}
        disabled={isLoading || loadingPass !== null}
        className="w-full sm:w-auto sm:min-w-[110px] h-10"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <ShoppingCart className="h-4 w-4 mr-1" />
            ${price}
          </>
        )}
      </Button>
    );
  };

  return (
    <>
      {/* Class Pass Pricing */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <SectionHeading
            title="Class Pass"
            subtitle="Valid for all studio classes."
          />
          
          <div className="max-w-4xl mx-auto">
            <div className="card-luxury overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-4 bg-secondary/50 p-4 border-b border-border">
                <div className="font-medium">Package</div>
                <div className="font-medium text-center">Member Price</div>
                <div className="font-medium text-center">Non-Member Price</div>
                <div className="font-medium text-center">Purchase</div>
              </div>
              
              {/* Rows */}
              {classPassPricing.map((tier, index) => (
                <div 
                  key={tier.type}
                  className={`grid grid-cols-4 p-4 items-center ${
                    index !== classPassPricing.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="font-medium">{tier.type}</div>
                  <div className="text-center">
                    <span className={`text-2xl font-light ${isMember ? 'text-gold' : ''}`}>
                      ${tier.memberPrice}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className={`text-2xl font-light ${!isMember && user ? 'text-gold' : ''}`}>
                      ${tier.nonMemberPrice}
                    </span>
                  </div>
                  <div className="text-center">
                    {user ? (
                      <PurchaseButton 
                        category="pilatesCycling" 
                        passType={tier.passType}
                        price={isMember ? tier.memberPrice : tier.nonMemberPrice}
                      />
                    ) : (
                      <div className="flex flex-col gap-1 items-center">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/auth?redirect=/class-passes">Sign In</Link>
                        </Button>
                        <Link to="/auth?redirect=/class-passes" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Create Account
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pass Information */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pass Validity */}
              <div className="card-luxury p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                <h3 className="font-serif text-xl mb-2">Pass Validity</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      10 Class Packs are valid for 2 months. Single Class Passes are valid for 1 week.
                      A small processing fee applies at checkout.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                        <span>Use across any eligible class type</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                        <span>Classes do not roll over after expiration</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Non-Member Access */}
              <div className="card-luxury p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl mb-2">Non-Member Access</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Non-member class passes provide access to studios only.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                        <span>Studio access for booked class</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                        <span>Amenities not included</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Cancellation Policy */}
            <div className="card-luxury p-6 mt-6">
              <h3 className="font-serif text-xl mb-4">Cancellation Policy</h3>
              <p className="text-muted-foreground">
                Classes must be cancelled at least <strong className="text-foreground">24 hours in advance</strong> to 
                avoid forfeiting your class credit or pass. No-shows will result in the class being marked as used.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Membership CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="heading-section text-primary-foreground mb-4">
              Looking for Full Access?
            </h2>
            <p className="text-primary-foreground/70 mb-8">
              Members receive discounted class pricing plus access to all club amenities, 
              spa services, and priority booking.
            </p>
            <Button variant="gold" size="lg" asChild>
              <Link to="/apply">Apply for Membership</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

export default function ClassPasses() {
  const { user } = useAuth();
  const { data: membership } = useUserMembership();
  const { profile } = useUserProfile();
  const { profile: nonMemberProfile } = useNonMemberProfile();
  const { data: singleClassAgreements } = useAgreements("single_class_pass");
  const { data: classPackageAgreements } = useAgreements("class_package");
  const [loadingPass, setLoadingPass] = useState<string | null>(null);
  const [showWaiverFor, setShowWaiverFor] = useState<{
    type: string;
    title: string;
    pendingPurchase?: { category: 'pilatesCycling'; passType: 'single' | 'tenPack' };
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: credits, refetch: refetchCredits } = useUserCredits();

  const isMember = membership?.status === 'active';
  
  // Check which agreements are configured and needed
  const hasSingleClassAgreementConfigured = singleClassAgreements && singleClassAgreements.length > 0;
  const hasClassPackageAgreementConfigured = classPackageAgreements && classPackageAgreements.length > 0;
  
  const needsSingleClassAgreement = !!profile && hasSingleClassAgreementConfigured && !profile.single_class_pass_agreement_signed;
  const needsClassPackageAgreement = !!profile && hasClassPackageAgreementConfigured && !profile.class_package_agreement_signed;

  // Waiver is valid if signed in either member or non-member profile
  const hasLiabilityWaiver = profile?.waiver_signed === true || nonMemberProfile?.waiver_signed === true;

  // Purchase success dialog state
  const [successOpen, setSuccessOpen] = useState(false);
  const [successPass, setSuccessPass] = useState<any>(null);

  // Detect Stripe return: backend appends ?session_id={CHECKOUT_SESSION_ID} to successUrl
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const purchase = searchParams.get("purchase");
    if (sessionId || purchase === "success") {
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      refetchCredits();
      if (sessionId) {
        supabase.functions
          .invoke("class-pass-confirm", { body: { session_id: sessionId } })
          .then(({ data }: any) => {
            if (data?.success && data?.paid) {
              setSuccessPass(data.pass);
              setSuccessOpen(true);
            } else {
              toast.success("Class pass purchased! Your pass is now active.");
            }
          })
          .catch(() => {
            toast.success("Class pass purchased! Your pass is now active.");
          });
      } else {
        toast.success("Class pass purchased! Your pass is now active.");
      }
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handlePurchase = async (
    category: 'pilatesCycling',
    passType: 'single' | 'tenPack'
  ) => {
    if (!user) {
      toast.error("Please sign in to purchase class passes");
      return;
    }

    // Check liability waiver first (universal requirement — covers both members and non-members)
    if (!hasLiabilityWaiver) {
      setShowWaiverFor({ type: "liability_waiver", title: "Liability Waiver", pendingPurchase: { category, passType } });
      toast.info("Please sign the Liability Waiver below before purchasing");
      return;
    }

    // Check if the specific agreement is needed — show inline signing prompt instead of blocking
    if (passType === 'single' && needsSingleClassAgreement) {
      setShowWaiverFor({ type: "single_class_pass", title: "Single Class Pass Agreement", pendingPurchase: { category, passType } });
      toast.info("Please sign the agreement below before purchasing");
      return;
    }
    
    if (passType === 'tenPack' && needsClassPackageAgreement) {
      setShowWaiverFor({ type: "class_package", title: "Class Package Agreement", pendingPurchase: { category, passType } });
      toast.info("Please sign the agreement below before purchasing");
      return;
    }

    console.log("[ClassPasses] Starting purchase:", { category, passType, isMember });

    const passKey = `${category}-${passType}`;
    setLoadingPass(passKey);

    try {
      const origin = window.location.origin;

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_class_pass_checkout",
          category,
          passType,
          isMember,
          // Pass clean URLs — backend appends ?session_id={CHECKOUT_SESSION_ID}
          successUrl: `${origin}/class-passes`,
          cancelUrl: `${origin}/class-passes?purchase=cancelled`,
        },
      });

      if (error) {
        console.error("[ClassPasses] Edge function error:", error);
        throw error;
      }

      console.log("[ClassPasses] Stripe response:", data);

      if (data?.url) {
        window.location.href = data.url;
      } else {
        console.error("[ClassPasses] No checkout URL in response:", data);
        throw new Error("No checkout URL returned from payment service");
      }
    } catch (error: any) {
      console.error("[ClassPasses] Checkout error:", error);
      const errorMessage = error?.message || "Failed to start checkout. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoadingPass(null);
    }
  };

  return (
    <Layout>
      <SEOHead
        title="Class Passes"
        description="Buy single class passes ($25 member / $30 non-member) or 10-class packs ($170 / $285) for Reformer Pilates, cycling, and yoga at Storm Wellness Club, Livonia MI."
        path="/class-passes"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Class Passes", path: "/class-passes" },
          ]),
          buildProductLd({
            name: "Single Class Pass",
            description: "One drop-in class for any Reformer Pilates, indoor cycling, or yoga session.",
            path: "/class-passes",
            price: 30,
            sku: "class-pass-single",
            category: "Class Pass",
          }),
          buildProductLd({
            name: "10 Class Pack",
            description: "Ten-class pack valid for any Reformer Pilates, indoor cycling, or yoga session. Members save with discounted pricing.",
            path: "/class-passes",
            price: 285,
            sku: "class-pass-10pack",
            category: "Class Pack",
          }),
          buildFAQLd([
            { q: "Do class passes expire?", a: "Yes — 10-class packs are typically valid for several months. Exact expiration is shown at checkout and in your account." },
            { q: "Do I need to be a member?", a: "No — anyone can purchase class passes with a free account. Members automatically receive discounted pricing." },
            { q: "Can I cancel a class?", a: "Cancellations follow our standard policy shown on the schedule page. Late cancellations may forfeit the credit." },
          ]),
        ]}
      />
      <ClassPassPurchaseSuccessDialog open={successOpen} onOpenChange={setSuccessOpen} pass={successPass} />
      {/* Hero */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-gold text-sm uppercase tracking-widest mb-4">Flexible Options</p>
            <h1 className="heading-display mb-6">Class Passes</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Purchase class passes valid for all studio classes. 
              Members receive discounted pricing on all class packages.
            </p>
            {!user ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="gold" size="sm">
                  <Link to="/auth?redirect=/class-passes">Sign In</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/auth?mode=signup&redirect=/class-passes">Create Free Account</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 text-gold text-sm">
                  <Check className="h-4 w-4" />
                  {isMember ? "Member pricing applied" : "Non-member pricing"}
                </div>
                {!isMember && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/portal">Go to My Dashboard</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Always show pricing tables */}
      {/* Your Active Passes — visible to logged-in non-members with at least one pass */}
      {user && (credits?.classPasses?.length ?? 0) > 0 && (
        <section className="py-10 bg-secondary/20 border-b border-border">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-serif text-2xl mb-4">Your Active Passes</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {credits!.classPasses.map((pass) => (
                  <div key={pass.id} className="card-luxury p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium capitalize">
                        {pass.category === 'pilates_cycling' ? 'Pilates & Cycling' : 'Other Classes'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold">Active</span>
                    </div>
                    <div className="text-3xl font-light text-gold mb-1">{pass.classes_remaining}</div>
                    <div className="text-xs text-muted-foreground">
                      classes remaining of {pass.classes_total}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Expires {new Date(pass.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <ClassPassPricingTables 
        onPurchase={handlePurchase}
        loadingPass={loadingPass}
        isMember={isMember}
        user={user}
      />

      {/* Show inline waiver signing prompt when needed */}
      {showWaiverFor && (
        <InlineWaiverPrompt
          agreementType={showWaiverFor.type}
          title={showWaiverFor.title}
          onSigned={() => {
            const pending = showWaiverFor.pendingPurchase;
            setShowWaiverFor(null);
            if (pending) {
              setTimeout(() => handlePurchase(pending.category, pending.passType), 300);
            }
          }}
        />
      )}
    </Layout>
  );
}
