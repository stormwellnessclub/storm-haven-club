import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { CalendarIcon, Loader2, ArrowRight, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { InlineWaiverGate } from "@/components/InlineWaiverGate";
import { AccountRequiredSection } from "@/components/AccountRequiredSection";

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

    if (!guestName || !guestEmail || !phoneNumber || !visitDate || visitInterests.length === 0) {
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
          phoneNumber: phoneNumber.trim(),
          validDate: format(visitDate, "yyyy-MM-dd"),
          memberReferral: memberReferral.trim() || null,
          visitInterests,
          visitNotes: visitNotes.trim() || null,
          addons: addonsData,
          successUrl: `${origin}/guest-pass?purchase=success`,
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
      toast.error(error?.message || "Failed to create checkout");
      setIsProcessing(false);
    }
  };

  const minDate = new Date();
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
              Complete Your Guest Pass — ${calculateTotal()}
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

export default function GuestPass() {
  const { user, loading: authLoading } = useAuth();

  // Handle purchase success/cancel from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");

    if (purchase === "success") {
      toast.success("Your guest pass has been purchased successfully!");
      window.history.replaceState({}, "", "/guest-pass");
    } else if (purchase === "cancelled") {
      toast.error("Purchase cancelled");
      window.history.replaceState({}, "", "/guest-pass");
    }
  }, []);

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
              title="Create an Account to Purchase"
              description="To purchase a guest pass, please create an account or sign in. This helps us prepare for your visit."
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Logged in - show waiver gate then form
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

          {/* Inline Waiver Gate - only guest_pass needed since liability is signed at account creation */}
          <InlineWaiverGate 
            requiredWaivers={["guest_pass"]}
            title="Sign Guest Pass Agreement"
            description="Before purchasing your guest pass, please review and sign the following agreement."
          >
            <GuestPassForm />
          </InlineWaiverGate>
        </div>
      </div>
    </Layout>
  );
}
