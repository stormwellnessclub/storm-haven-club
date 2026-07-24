import { useState, useEffect, useRef } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Plus, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

function NonMemberCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!stripe || !elements) return;
    setIsSubmitting(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setValidationError(submitError.message || "Please complete the form");
        setIsSubmitting(false);
        return;
      }

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });

      if (error) {
        toast.error(error.message || "Card setup failed");
        setIsSubmitting(false);
        return;
      }

      if (!setupIntent || setupIntent.status !== "succeeded") {
        toast.error("Card setup incomplete. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Sync card metadata to non_member_profiles
      await supabase.functions.invoke("stripe-payment", {
        body: { action: "sync_nonmember_card_metadata" },
      });

      setIsComplete(true);
      toast.success("Card added successfully!");
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      console.error("Setup error:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="py-8 text-center">
        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2">Card Added Successfully!</h3>
        <p className="text-muted-foreground">Your payment method has been saved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="min-h-[200px] max-h-[50vh] overflow-y-auto relative">
        {!isElementReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        )}
        <PaymentElement
          options={{ layout: "tabs" }}
          onReady={() => setIsElementReady(true)}
        />
      </div>
      {validationError && <p className="text-sm text-destructive mt-2">{validationError}</p>}
      <div className="sticky bottom-0 bg-background pt-4 mt-4 border-t flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !elements || isSubmitting || !isElementReady}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
          ) : (
            <><CreditCard className="mr-2 h-4 w-4" />Save Card</>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function PortalPaymentMethods() {
  const { user } = useAuth();
  const { profile, isLoading } = useNonMemberProfile();
  const queryClient = useQueryClient();
  const hasCard = profile?.card_last4;

  const [addCardOpen, setAddCardOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const setupKeyRef = useRef(0);

  const fetchClientSecret = async () => {
    setLoadingSecret(true);
    setSecretError(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_nonmember_setup_intent" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
      setupKeyRef.current += 1;
    } catch (err) {
      setSecretError(err instanceof Error ? err.message : "Failed to initialize card form");
    } finally {
      setLoadingSecret(false);
    }
  };

  useEffect(() => {
    if (addCardOpen && !clientSecret && !loadingSecret && !secretError) {
      fetchClientSecret();
    }
  }, [addCardOpen]);

  // Handle return from Stripe-hosted setup Checkout (admin-sent link flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("card_added");
    if (!flag) return;
    // Clean URL
    params.delete("card_added");
    const newSearch = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
    if (flag === "cancelled") {
      toast.info("Card setup cancelled");
      return;
    }
    (async () => {
      try {
        await supabase.functions.invoke("stripe-payment", {
          body: { action: "sync_nonmember_card_metadata" },
        });
        toast.success("Card added successfully!");
        queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
      } catch {
        toast.error("Card saved but sync failed — try refreshing");
      }
    })();
  }, [user?.id, queryClient]);


  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setClientSecret(null);
      setSecretError(null);
    }
    setAddCardOpen(open);
  };

  const handleSuccess = () => {
    setClientSecret(null);
    setSecretError(null);
    setAddCardOpen(false);
    queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
  };

  return (
    <PortalLayout title="Payment Methods">
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Keep a card on file for class bookings, recovery sessions, and other services.
        </p>

        {hasCard ? (
          <Card>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {profile?.card_brand?.toUpperCase()} •••• {profile?.card_last4}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires {profile?.card_exp_month}/{profile?.card_exp_year}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>Default</Badge>
                <Button variant="outline" size="sm" onClick={() => setAddCardOpen(true)}>
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">No payment method on file</p>
              <p className="text-sm text-muted-foreground mb-4">
                A card is required for bookings and purchases.
              </p>
              <Button onClick={() => setAddCardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={addCardOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-accent" />
              {hasCard ? "Update Payment Method" : "Add Payment Method"}
            </DialogTitle>
            <DialogDescription>
              Add a card for class bookings and recovery sessions.
            </DialogDescription>
          </DialogHeader>

          {loadingSecret && (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-accent" />
              <p className="text-muted-foreground">Preparing secure form...</p>
            </div>
          )}

          {secretError && (
            <div className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
              <p className="text-destructive mb-4">{secretError}</p>
              <Button variant="outline" onClick={fetchClientSecret}>Try Again</Button>
            </div>
          )}

          {clientSecret && !loadingSecret && !secretError && (
            <StripeProvider key={`stripe-nm-${setupKeyRef.current}`} clientSecret={clientSecret}>
              <NonMemberCardForm
                onSuccess={handleSuccess}
                onCancel={() => handleOpenChange(false)}
              />
            </StripeProvider>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
