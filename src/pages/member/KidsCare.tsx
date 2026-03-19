import { useState, useEffect } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Baby, Loader2, X, CheckCircle2, FileText, CalendarPlus, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { SimpleAgreementCard } from "@/components/SimpleAgreementCard";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

// Lazily load Stripe
let stripeInstancePromise: ReturnType<typeof loadStripe> | null = null;
function getStripeInstance() {
  if (!stripeInstancePromise) {
    stripeInstancePromise = supabase.functions.invoke("stripe-config").then(({ data }) => {
      return loadStripe(data?.publishableKey || "");
    });
  }
  return stripeInstancePromise;
}

export default function MemberKidsCare() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Check for successful return from embedded checkout
  const sessionId = searchParams.get("session_id");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (sessionId) {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["kids-care-pass-status"] });
      // Clean up URL
      window.history.replaceState({}, "", "/member/kids-care");
    }
  }, [sessionId]);

  // Fetch active kids care pass
  const { data: passData, isLoading: passLoading } = useQuery({
    queryKey: ["kids-care-pass-status", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Check for active kids care subscription via members table
      const { data: member } = await supabase
        .from("members")
        .select("id, kids_care_subscription_id, kids_care_sessions_remaining, kids_care_pass_expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return member;
    },
    enabled: !!user,
  });

  // Fetch kids care agreements
  const { data: agreements } = useQuery({
    queryKey: ["kids-care-agreements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agreements")
        .select("*")
        .eq("agreement_type", "kids_care")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  // Sign agreement mutation
  const signAgreement = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({
          kids_care_agreement_signed: true,
          kids_care_agreement_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
      toast.success("Kids Care agreement signed successfully!");
    },
    onError: (err) => {
      toast.error("Failed to sign agreement: " + (err instanceof Error ? err.message : "Unknown error"));
    },
  });

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_kids_care_checkout", embedded: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clientSecret) throw new Error("No checkout session returned");
      setCheckoutClientSecret(data.clientSecret);
    } catch (err) {
      console.error("Kids Care checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setIsPurchasing(false);
    }
  };

  const agreementSigned = profile?.kids_care_agreement_signed ?? false;
  const serviceFormCompleted = profile?.kids_care_service_form_completed ?? false;
  const hasActivePass = !!(passData?.kids_care_subscription_id && passData?.kids_care_sessions_remaining > 0);
  const isLoading = profileLoading || passLoading;

  // Embedded checkout view
  if (checkoutClientSecret) {
    return (
      <MemberLayout title="Kids Care — Checkout">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Complete Payment — Kids Care Pass</h2>
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
      </MemberLayout>
    );
  }

  return (
    <MemberLayout title="Kids Care">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success Message */}
        {showSuccess && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Kids Care Pass purchased successfully!</p>
                <p className="text-xs text-muted-foreground">Your pass is now active. Register your children and book sessions below.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Step 1: Agreement */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Kids Care Agreement
                  </CardTitle>
                  {agreementSigned && (
                    <Badge variant="outline" className="text-green-600 border-green-600/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Signed
                    </Badge>
                  )}
                </div>
                {!agreementSigned && (
                  <CardDescription>Please review and sign the Kids Care agreement before purchasing a pass.</CardDescription>
                )}
              </CardHeader>
              {!agreementSigned && (
                <CardContent>
                  <SimpleAgreementCard
                    title="Kids Care Agreement"
                    description="Review the Kids Care policies, terms, and liability information."
                    documents={
                      agreements?.map((a) => ({ name: a.title, url: a.pdf_url || "" })).filter((d) => d.url) || []
                    }
                    onSign={() => signAgreement.mutate()}
                    isSigning={signAgreement.isPending}
                  />
                </CardContent>
              )}
            </Card>

            {/* Step 2: Pass Status & Purchase */}
            {agreementSigned && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Baby className="h-5 w-5" />
                    Kids Care Pass
                  </CardTitle>
                  <CardDescription>
                    {hasActivePass
                      ? "Your pass is active. Book sessions for your children below."
                      : "$75/month — 4 sessions per month, 2 hours max per session. Auto-renews monthly."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasActivePass ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <span className="text-sm font-medium">Sessions Remaining</span>
                        <Badge variant="default">{passData?.kids_care_sessions_remaining ?? 0} / 4</Badge>
                      </div>
                      {passData?.kids_care_pass_expires_at && (
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <span className="text-sm font-medium">Renews</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(passData.kids_care_pass_expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={handlePurchase}
                      loading={isPurchasing}
                      loadingText="Starting checkout..."
                      size="lg"
                      className="w-full"
                    >
                      <Baby className="h-4 w-4 mr-2" />
                      Purchase Kids Care Pass — $75/mo
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Quick Actions */}
            {agreementSigned && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card variant="interactive" onClick={() => navigate("/member/kids-care-service-form")}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Register Your Children</p>
                      <p className="text-xs text-muted-foreground">
                        {serviceFormCompleted ? "Update child info" : "Required before booking"}
                      </p>
                    </div>
                    {serviceFormCompleted && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto shrink-0" />
                    )}
                  </CardContent>
                </Card>
                <Card
                  variant="interactive"
                  onClick={() => navigate("/member/kids-care-bookings")}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <CalendarPlus className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Book a Session</p>
                      <p className="text-xs text-muted-foreground">View available times & book</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </MemberLayout>
  );
}
