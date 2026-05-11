import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Baby, Loader2, X, CheckCircle2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useKidsCarePasses } from "@/hooks/useKidsCareBooking";
import { useUserProfile } from "@/hooks/useUserProfile";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

// Lazy-load Stripe (mirrors src/pages/member/KidsCare.tsx)
let stripeInstancePromise: ReturnType<typeof loadStripe> | null = null;
function getStripeInstance() {
  if (!stripeInstancePromise) {
    stripeInstancePromise = supabase.functions
      .invoke("stripe-config")
      .then(({ data }) => loadStripe(data?.publishableKey || ""));
  }
  return stripeInstancePromise;
}

interface KidsCarePassGateProps {
  /** When true, render the gate even if a pass exists (used in modals where we only want to nudge if missing). Defaults to false. */
  alwaysRender?: boolean;
}

/**
 * Inline gate shown wherever a member tries to book Kids Care.
 * - If they already have an active pass → renders nothing.
 * - If no pass + agreement signed → inline "Buy Kids Care Pass" with embedded Stripe checkout.
 * - If no pass + agreement NOT signed → "Sign agreement & buy pass" button to /member/kids-care.
 */
export function KidsCarePassGate(_props: KidsCarePassGateProps = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data: passes, isLoading: passesLoading } = useKidsCarePasses();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // After Stripe redirects back with ?session_id=..., refetch passes so the
  // gate disappears automatically.
  const sessionId = searchParams.get("session_id");
  useEffect(() => {
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: ["kids-care-passes"] });
    }
  }, [sessionId, queryClient]);

  if (passesLoading || profileLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your Kids Care pass…
      </div>
    );
  }

  const hasActivePass = (passes?.length ?? 0) > 0;
  if (hasActivePass) return null;

  const agreementSigned = profile?.kids_care_agreement_signed ?? false;

  const startCheckout = async () => {
    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_kids_care_checkout", embedded: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clientSecret) throw new Error("No checkout session returned");
      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error("Kids Care checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <>
      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Baby className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-sm">
                {agreementSigned
                  ? "Active Kids Care Pass required to book"
                  : "Sign the Kids Care agreement to get started"}
              </p>
              <p className="text-xs text-muted-foreground">
                {agreementSigned
                  ? "$75/month — 16 sessions per month, 2 hours max per session. Auto-renews monthly — cancel anytime."
                  : "Review and sign the Kids Care agreement, then purchase your monthly pass."}
              </p>
            </div>
          </div>
          {agreementSigned ? (
            <Button
              onClick={startCheckout}
              loading={isPurchasing}
              loadingText="Starting…"
              className="gap-2 shrink-0"
            >
              <Baby className="h-4 w-4" />
              Buy Kids Care Pass — $75/mo
            </Button>
          ) : (
            <Button
              variant="default"
              className="gap-2 shrink-0"
              onClick={() => navigate("/member/kids-care")}
            >
              <FileText className="h-4 w-4" />
              Sign agreement & buy pass
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Embedded checkout dialog */}
      <Dialog
        open={!!clientSecret}
        onOpenChange={(open) => {
          if (!open) setClientSecret(null);
        }}
      >
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Kids Care Pass — Checkout
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClientSecret(null)}
              className="h-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="px-2 pb-2">
            {clientSecret && (
              <EmbeddedCheckoutProvider
                stripe={getStripeInstance()}
                options={{ clientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
