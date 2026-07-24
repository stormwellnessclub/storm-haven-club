import { useState, useEffect } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, Sparkles, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useSearchParams } from "react-router-dom";

// Lazily load Stripe with the publishable key from edge function
let stripeInstancePromise: ReturnType<typeof loadStripe> | null = null;
function getStripeInstance() {
  if (!stripeInstancePromise) {
    stripeInstancePromise = supabase.functions.invoke("stripe-config").then(({ data }) => {
      return loadStripe(data?.publishableKey || "");
    });
  }
  return stripeInstancePromise;
}

const recoveryServices = [
  {
    name: "Red Light Therapy",
    description: "Full-body red light therapy session for recovery, skin health, and inflammation reduction.",
    duration: "20 min",
    price: "$28",
    serviceKey: "rlt20",
    creditType: "red_light" as const,
  },
  {
    name: "Dry Cryo",
    description: "Whole-body cryotherapy session to reduce muscle soreness and boost recovery.",
    duration: "3 min",
    price: "$45",
    serviceKey: "cryo",
    creditType: "dry_cryo" as const,
  },
  {
    name: "Ozone Sauna",
    description: "60-minute ozone sauna session for detoxification, circulation, and recovery. Spa Room 3.",
    duration: "60 min",
    price: "$85",
    serviceKey: "ozone",
    creditType: "ozone" as const,
  },
];

const wellnessPacks = [
  {
    name: "Red Light Therapy 4-Pack",
    description: "4 red light therapy sessions at a discounted rate.",
    sessions: 4,
    creditType: "red_light" as const,
    price: "$100",
  },
  {
    name: "Dry Cryo 4-Pack",
    description: "4 dry cryotherapy sessions at a discounted rate.",
    sessions: 4,
    creditType: "dry_cryo" as const,
    price: "$160",
  },
  {
    name: "Ozone Sauna 6-Pack",
    description: "6 Ozone Sauna sessions. Paid in full.",
    sessions: 6,
    creditType: "ozone" as const,
    price: "$450",
  },
  {
    name: "Ozone Sauna 20-Pack",
    description: "20 Ozone Sauna sessions. Paid in full — best value.",
    sessions: 20,
    creditType: "ozone" as const,
    price: "$1,300",
  },
];

export default function PortalRecovery() {
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [checkoutLabel, setCheckoutLabel] = useState<string>("");
  const { data: creditsData, isLoading: creditsLoading } = useUserCredits();
  const { profile } = useNonMemberProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle return from embedded checkout
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      toast.success("Payment successful! Your credits will be available shortly.");
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const needsProfileCompletion = profile && (!profile.first_name || !profile.last_name || !profile.phone);

  const handleUseCredit = async (serviceKey: string, creditType: "red_light" | "dry_cryo" | "ozone") => {
    // For non-members, we book directly via the edge function or just deduct credit
    setLoadingService(serviceKey);
    try {
      // Deduct credit from member_credits
      const now = new Date().toISOString();
      const { data: credits, error: fetchError } = await supabase
        .from("member_credits")
        .select("*")
        .eq("user_id", user!.id)
        .eq("credit_type", creditType as any)
        .gt("credits_remaining", 0)
        .gt("expires_at", now)
        .order("expires_at", { ascending: true })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!credits || credits.length === 0) throw new Error("No credits available");

      const credit = credits[0];
      const { error: updateError } = await supabase
        .from("member_credits")
        .update({ credits_remaining: credit.credits_remaining - 1 })
        .eq("id", credit.id);

      if (updateError) throw updateError;

      toast.success("Credit redeemed! Your session has been booked.");
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    } catch (err) {
      console.error("Credit redemption error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to redeem credit");
    } finally {
      setLoadingService(null);
    }
  };

  const handleBookSession = async (serviceKey: string) => {
    if (needsProfileCompletion) {
      toast.error("Please complete your profile (name and phone) before purchasing.", {
        action: { label: "Go to Profile", onClick: () => window.location.href = "/portal/profile" },
      });
      return;
    }

    setLoadingService(serviceKey);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_recovery_checkout", serviceName: serviceKey, embedded: true },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clientSecret) throw new Error("No checkout session returned");

      setCheckoutClientSecret(data.clientSecret);
      setCheckoutLabel(recoveryServices.find(s => s.serviceKey === serviceKey)?.name || "Session");
    } catch (err) {
      console.error("Recovery checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoadingService(null);
    }
  };

  const handleBuyPack = async (creditType: string, quantity: number) => {
    if (needsProfileCompletion) {
      toast.error("Please complete your profile (name and phone) before purchasing.", {
        action: { label: "Go to Profile", onClick: () => window.location.href = "/portal/profile" },
      });
      return;
    }

    setLoadingService(`pack-${creditType}`);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_wellness_credit_checkout", creditType, quantity },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clientSecret) throw new Error("No checkout session returned");

      setCheckoutClientSecret(data.clientSecret);
      const packLabel = creditType === "red_light" ? "Red Light" : creditType === "dry_cryo" ? "Dry Cryo" : "Ozone Sauna";
      setCheckoutLabel(`${packLabel} ${quantity}-Pack`);
    } catch (err) {
      console.error("Pack checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoadingService(null);
    }
  };

  // Show embedded checkout if active
  if (checkoutClientSecret) {
    return (
      <PortalLayout title="Checkout">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-section">Complete Payment — {checkoutLabel}</h2>
            <Button variant="ghost" size="sm" onClick={() => setCheckoutClientSecret(null)}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <EmbeddedCheckoutProvider
                stripe={getStripeInstance()}
                options={{ clientSecret: checkoutClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  const redLightCredits = creditsData?.redLightCredits;
  const dryCredits = creditsData?.dryCredits;
  const ozoneCredits = creditsData?.ozoneCredits;

  return (
    <PortalLayout title="Recovery & Wellness">
      <div className="max-w-3xl space-y-6">
        {/* Profile completion warning */}
        {needsProfileCompletion && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-3 flex items-center justify-between">
              <p className="text-sm text-destructive">
                Please complete your name and phone number before making purchases.
              </p>
              <Button size="sm" variant="outline" onClick={() => window.location.href = "/portal/profile"}>
                Complete Profile
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Your Wellness Credits */}
        {(redLightCredits || dryCredits) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-accent" />
                Your Wellness Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {redLightCredits && redLightCredits.credits_remaining > 0 && (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Red Light Therapy</p>
                      <p className="text-xs text-muted-foreground">{redLightCredits.credits_remaining} session{redLightCredits.credits_remaining !== 1 ? "s" : ""} remaining</p>
                    </div>
                    <Badge variant="default" className="text-xs">{redLightCredits.credits_remaining}</Badge>
                  </div>
                )}
                {dryCredits && dryCredits.credits_remaining > 0 && (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Dry Cryotherapy</p>
                      <p className="text-xs text-muted-foreground">{dryCredits.credits_remaining} session{dryCredits.credits_remaining !== 1 ? "s" : ""} remaining</p>
                    </div>
                    <Badge variant="default" className="text-xs">{dryCredits.credits_remaining}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Single Session Booking */}
        <div>
          <h2 className="heading-section">Recovery Sessions</h2>
          <p className="text-muted-foreground mt-1">
            Book a recovery session. Use your credits or pay per session.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recoveryServices.map((service) => {
            const hasCredit = service.creditType === "red_light"
              ? (redLightCredits?.credits_remaining ?? 0) > 0
              : (dryCredits?.credits_remaining ?? 0) > 0;

            return (
              <Card key={service.serviceKey}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-accent" />
                    {service.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{service.duration}</span>
                    <span className="font-semibold">{service.price}</span>
                  </div>
                  <div className="flex gap-2">
                    {hasCredit && (
                      <Button
                        className="flex-1"
                        variant="default"
                        onClick={() => handleUseCredit(service.serviceKey, service.creditType)}
                        disabled={loadingService === service.serviceKey}
                      >
                        {loadingService === service.serviceKey ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                        ) : (
                          <><Sparkles className="mr-2 h-4 w-4" />Use Credit</>
                        )}
                      </Button>
                    )}
                    <Button
                      className={hasCredit ? "flex-1" : "w-full"}
                      variant={hasCredit ? "outline" : "default"}
                      onClick={() => handleBookSession(service.serviceKey)}
                      disabled={loadingService === service.serviceKey}
                    >
                      {loadingService === service.serviceKey && !hasCredit ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                      ) : (
                        "Pay & Book"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Credit Packs */}
        <div>
          <h2 className="heading-section">Credit Packs</h2>
          <p className="text-muted-foreground mt-1">
            Save by purchasing multiple sessions upfront.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {wellnessPacks.map((pack) => (
            <Card key={`${pack.creditType}-pack`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-5 w-5 text-accent" />
                  {pack.name}
                </CardTitle>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{pack.sessions} sessions</span>
                  <span className="font-semibold">{pack.price}</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleBuyPack(pack.creditType, pack.sessions)}
                  disabled={loadingService === `pack-${pack.creditType}`}
                >
                  {loadingService === `pack-${pack.creditType}` ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                  ) : (
                    "Buy Pack"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
