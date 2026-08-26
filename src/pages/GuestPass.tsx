import { useState, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon, Loader2, ArrowRight, Info, CheckCircle2, MapPin, Clock, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, startOfDay } from "date-fns";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import { cn } from "@/lib/utils";
import { AccountRequiredSection } from "@/components/AccountRequiredSection";
import { SimpleAgreementCard } from "@/components/SimpleAgreementCard";
import { useUserProfile } from "@/hooks/useUserProfile";

const GUEST_PASS_PRICE = 60;

const VISIT_INTERESTS = [
  { id: "movement", label: "Movement & Training" },
  { id: "recovery", label: "Recovery Therapies" },
  { id: "spa", label: "Spa Amenities" },
  { id: "exploring", label: "Just exploring the space" },
];

const RECOVERY_ADDONS = [
  { id: "rlt_10", label: "Full Body Red Light Therapy — 10 minutes", price: 18 },
  { id: "rlt_20", label: "Full Body Red Light Therapy — 20 minutes", price: 28 },
  { id: "cryo", label: "ZeroBody Cryo", price: 45 },
];

const CLASS_ADDONS = [
  { id: "class_pilates_cycling", label: "Reformer Pilates or Cycling — Single Class", price: 40 },
  { id: "class_other", label: "Aerobics & Other Studios — Single Class", price: 30 },
];

// Extracted form component
function GuestPassForm() {
  const { user } = useAuth();

  // Form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [guestGender, setGuestGender] = useState<'male' | 'female' | ''>('');
  const [visitDate, setVisitDate] = useState<Date | undefined>(undefined);
  const [memberReferral, setMemberReferral] = useState("");
  const [visitInterests, setVisitInterests] = useState<string[]>([]);
  const [visitNotes, setVisitNotes] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Pre-populate email from user
  useEffect(() => {
    if (user?.email && !guestEmail) {
      setGuestEmail(user.email);
    }
  }, [user, guestEmail]);

  // Calculate total price
  const calculateTotal = () => {
    let total = GUEST_PASS_PRICE;
    selectedAddons.forEach((addonId) => {
      const recoveryAddon = RECOVERY_ADDONS.find((a) => a.id === addonId);
      const classAddon = CLASS_ADDONS.find((a) => a.id === addonId);
      if (recoveryAddon) total += recoveryAddon.price;
      if (classAddon) total += classAddon.price;
    });
    return total;
  };

  const toggleInterest = (interestId: string) => {
    setVisitInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((i) => i !== interestId)
        : [...prev, interestId]
    );
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((a) => a !== addonId)
        : [...prev, addonId]
    );
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to continue");
      return;
    }

    if (!guestName || !guestEmail || !phoneNumber || !guestGender || !visitDate || visitInterests.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsProcessing(true);

    try {
      const origin = window.location.origin;
      const addonsData = selectedAddons.map((id) => {
        const recovery = RECOVERY_ADDONS.find((a) => a.id === id);
        const classAddon = CLASS_ADDONS.find((a) => a.id === id);
        return recovery || classAddon;
      }).filter(Boolean);

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_guest_pass_experience_checkout",
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestGender,
          phoneNumber: phoneNumber.trim(),
          validDate: format(visitDate, "yyyy-MM-dd"),
          memberReferral: memberReferral.trim() || null,
          visitInterests,
          visitNotes: visitNotes.trim() || null,
          addons: addonsData,
          // Pass clean URLs — backend appends ?session_id={CHECKOUT_SESSION_ID}
          successUrl: `${origin}/guest-pass`,
          cancelUrl: `${origin}/guest-pass?purchase=cancelled`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      console.error("Error creating guest pass checkout:", error);
      const raw = error?.message || error?.error?.message || "Failed to create checkout";
      toast.error(raw);
      setIsProcessing(false);
    }
  };

  const minDate = startOfDay(new Date());
  const maxDate = addDays(new Date(), 7);

  return (
    <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {/* Main Form - Left Side */}
      <div className="lg:col-span-2 space-y-8">
        {/* Guest Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Guest Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Full Name *</Label>
                <Input
                  id="guestName"
                  placeholder="Your full name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Email Address *</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Visit *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !visitDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {visitDate ? format(visitDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={visitDate}
                      onSelect={setVisitDate}
                      disabled={(date) => date < minDate || date > maxDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sex *</Label>
              <RadioGroup 
                value={guestGender} 
                onValueChange={(v) => setGuestGender(v as 'male' | 'female')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="font-normal cursor-pointer">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="font-normal cursor-pointer">Male</Label>
                </div>
              </RadioGroup>
              {guestGender === "male" && (
                <div className="mt-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    We're sorry, guest passes are currently at capacity. Please email us at{" "}
                    <a href="mailto:info@stormwellnessclub.com" className="underline font-medium">
                      info@stormwellnessclub.com
                    </a>{" "}
                    for more information.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="memberReferral">Guest of (Member Name)</Label>
              <Input
                id="memberReferral"
                placeholder="If you're visiting as someone's guest (optional)"
                value={memberReferral}
                onChange={(e) => setMemberReferral(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Your Visit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Visit</CardTitle>
            <CardDescription>
              What are you most excited to experience today?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {VISIT_INTERESTS.map((interest) => (
                <div
                  key={interest.id}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                    visitInterests.includes(interest.id)
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => toggleInterest(interest.id)}
                >
                  <Checkbox
                    checked={visitInterests.includes(interest.id)}
                    onCheckedChange={() => toggleInterest(interest.id)}
                  />
                  <span className="text-sm">{interest.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="visitNotes">
                Is there anything we should know to support your visit?
              </Label>
              <Textarea
                id="visitNotes"
                placeholder="Preferences, injuries, sensitivities, or intentions (optional)"
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Enhance Your Experience */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enhance Your Experience</CardTitle>
            <CardDescription>
              As our guest, you have access to our premium recovery services and studio 
              classes at member value.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recovery Services */}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
                Recovery Services
              </p>
              <div className="space-y-2">
                {RECOVERY_ADDONS.map((addon) => (
                  <div
                    key={addon.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors",
                      selectedAddons.includes(addon.id)
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                    onClick={() => toggleAddon(addon.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedAddons.includes(addon.id)}
                        onCheckedChange={() => toggleAddon(addon.id)}
                      />
                      <span className="text-sm">{addon.label}</span>
                    </div>
                    <span className="font-medium">${addon.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Studio Classes */}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">
                Studio Classes
              </p>
              <div className="space-y-2">
                {CLASS_ADDONS.map((addon) => (
                  <div
                    key={addon.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors",
                      selectedAddons.includes(addon.id)
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                    onClick={() => toggleAddon(addon.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedAddons.includes(addon.id)}
                        onCheckedChange={() => toggleAddon(addon.id)}
                      />
                      <span className="text-sm">{addon.label}</span>
                    </div>
                    <span className="font-medium">${addon.price}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Classes are subject to availability. Book your class after completing your 
                guest pass purchase.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          className="w-full"
          size="lg"
          disabled={
            !guestName ||
            !guestEmail ||
            !phoneNumber ||
            !guestGender ||
            guestGender === "male" ||
            !visitDate ||
            visitInterests.length === 0 ||
            isProcessing
          }
          onClick={handleSubmit}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Complete Your Guest Pass — ${calculateTotal()} + ${calculateProcessingFeeFromDollars(calculateTotal()).toFixed(2)} processing fee
            </>
          )}
        </Button>
      </div>

      {/* Right Sidebar */}
      <div className="space-y-6">
        {/* What's Included */}
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-4 w-4 text-accent" />
              What's Included
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your ${GUEST_PASS_PRICE} guest pass includes:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                Full gym access
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                Recovery suite (sauna, steam, cold plunge)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                Locker room amenities
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                Towel service
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Gentle Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">A Few Gentle Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• Guest access is valid for your selected visit date only</p>
            <p>• We ask that all guests respect the quiet energy of shared spaces</p>
            <p>• Phones are limited in wellness areas to protect privacy and presence</p>
            <p>• Kids Care is available to members only</p>
            
            <Separator className="my-4" />
            
            <div>
              <p className="text-xs uppercase tracking-widest font-medium text-foreground mb-2">
                Guest Passes Are Limited
              </p>
              <p className="text-xs">
                Subject to availability. We reserve the right to limit guest access during 
                peak hours.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Looking Ahead */}
        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-lg">Looking Ahead</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-primary-foreground/80 mb-4">
              If today resonates with you, we'd love to welcome you as a member.
            </p>
            <Link to="/memberships">
              <Button variant="hero-outline" size="sm" className="w-full group">
                Learn About Membership
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuestPassSuccess() {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-8">
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Thank You!</h2>
        <p className="text-lg text-muted-foreground">
          Your guest pass has been confirmed. We look forward to welcoming you.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-accent mt-0.5 shrink-0" />
            <div className="text-left">
              <p className="font-medium">Storm Wellness Club</p>
              <p className="text-sm text-muted-foreground">18340 Middlebelt Rd, Livonia, MI 48152</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-accent mt-0.5 shrink-0" />
            <div className="text-left text-sm text-muted-foreground space-y-1">
             <p className="font-medium text-foreground">Hours</p>
              <p className="font-semibold text-accent">Currently in Soft Launch — contact club for hours</p>
              <p>Mon–Thu: 5:30 AM – 11:00 PM</p>
              <p>Friday: 5:30 AM – 8:00 PM</p>
              <p>Sat–Sun: 7:00 AM – 7:00 PM</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-accent mt-0.5 shrink-0" />
            <div className="text-left">
              <a href="tel:+12482328487" className="text-sm hover:text-accent transition-colors">(248) 232-8487</a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-secondary/30">
        <CardHeader>
          <CardTitle className="text-lg">What to Expect on Your Visit</CardTitle>
        </CardHeader>
        <CardContent className="text-left space-y-3 text-sm text-muted-foreground">
          <p>• Please bring a valid photo ID</p>
          <p>• Arrive 10–15 minutes early to check in at the front desk</p>
          <p>• Towels and locker room amenities are provided</p>
          
          <p>• Phones are limited in wellness areas to protect privacy</p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild>
          <Link to="/">
            Back to Home
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/guest-pass?purchase=reset">
            Purchase Another Pass
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function GuestPass() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const purchase = searchParams.get("purchase");
  const sessionId = searchParams.get("session_id");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  // Handle cancelled purchase
  useEffect(() => {
    if (purchase === "cancelled") {
      toast.error("Purchase cancelled");
      setSearchParams({}, { replace: true });
    } else if (purchase === "reset") {
      setSearchParams({}, { replace: true });
    }
  }, [purchase, setSearchParams]);

  // After Stripe returns with session_id, verify the payment succeeded
  useEffect(() => {
    if (!sessionId || verified || verifying) return;
    setVerifying(true);
    supabase.functions
      .invoke("class-pass-confirm", { body: { session_id: sessionId } })
      .then(() => {
        setVerified(true);
      })
      .catch(() => {
        // Even if verify endpoint isn't a fit (guest pass), webhook fulfills.
        setVerified(true);
      })
      .finally(() => setVerifying(false));
  }, [sessionId, verified, verifying]);

  // Show success confirmation
  if (purchase === "success" || sessionId) {
    return (
      <Layout>
        <div className="min-h-screen bg-background pt-32 pb-20">
          <div className="container mx-auto px-6">
            <GuestPassSuccess />
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  // Not logged in - show account creation prompt
  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen bg-background pt-32 pb-20">
          <div className="container mx-auto px-6">
            {/* Header */}
            <div className="text-center mb-12">
              <p className="text-accent text-sm uppercase tracking-widest mb-3">
                Welcome to Storm Wellness Club
              </p>
              <h1 className="heading-section mb-4">Guest Pass Experience</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A shared ritual of movement, recovery, and presence. We invite you to experience 
                our sanctuary for a day.
              </p>
            </div>

            <AccountRequiredSection
              redirectTo="/guest-pass"
              title="Sign in to Purchase a Guest Pass"
              description="Sign in to your account or create a free one to purchase your guest pass."
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Logged in - show inline agreements then form
  return (
    <Layout>
      <SEOHead
        title="Day Guest Pass — Gym, Spa & Sauna Access in Livonia, MI"
        description="Buy a one-day guest pass to Storm Wellness Club in Livonia, MI. Full club access — sauna, salt room, cold plunge, and a group class. No membership required."
        path="/guest-pass"
      />
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-accent text-sm uppercase tracking-widest mb-3">
              Welcome to Storm Wellness Club
            </p>
            <h1 className="heading-section mb-4">Guest Pass Experience</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A shared ritual of movement, recovery, and presence. We invite you to experience 
              our sanctuary for a day.
            </p>
          </div>

          <InlineGuestPassAgreements />
        </div>
      </div>
    </Layout>
  );
}

function InlineGuestPassAgreements() {
  const {
    profile,
    isLoading,
    signWaiver,
    isSigningWaiver,
    signGuestPassAgreement,
    isSigningGuestPassAgreement,
  } = useUserProfile();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const waiverSigned = profile?.waiver_signed ?? false;
  const guestPassSigned = profile?.guest_pass_agreement_signed ?? false;

  // Step 1: Liability Waiver
  if (!waiverSigned) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Step 1 of 2 — Liability Waiver</CardTitle>
            <CardDescription>
              Please review and sign the liability waiver before purchasing your guest pass.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleAgreementCard
              title="Liability Waiver"
              documents={[{ name: "Liability Waiver", url: "liability-waiver.pdf" }]}
              onSign={() => signWaiver()}
              isSigning={isSigningWaiver}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Guest Pass Agreement
  if (!guestPassSigned) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Step 2 of 2 — Guest Pass Agreement</CardTitle>
            <CardDescription>
              Almost there! Please review and sign the guest pass agreement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleAgreementCard
              title="Guest Pass Agreement"
              documents={[{ name: "Guest Pass Agreement", url: "guest-pass-agreement-general.pdf" }]}
              onSign={() => signGuestPassAgreement()}
              isSigning={isSigningGuestPassAgreement}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Both signed — show purchase form
  return <GuestPassForm />;
}
