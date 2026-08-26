import { useState, useEffect } from "react";
import { Clock, CheckCircle, Mail, Phone, ArrowLeft, CreditCard, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import logo from "@/assets/storm-logo-gold.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { formatSetupError } from "@/lib/stripeErrors";

interface ApplicationUnderReviewProps {
  applicationData: {
    id: string;
    full_name: string;
    email: string;
    membership_plan: string;
    created_at: string;
    status: string;
    stripe_customer_id?: string | null;
    card_brand?: string | null;
    card_last4?: string | null;
    card_exp_month?: number | null;
    card_exp_year?: number | null;
  };
}

// Inner form component that uses Stripe hooks
function PaymentFormInner({ 
  onSuccess, 
  onCancel,
  applicationId,
  applicantEmail,
  applicantName,
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);

    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        toast.error(formatSetupError(error));
        setIsSubmitting(false);
        return;
      }

      if (setupIntent?.status === "succeeded" && setupIntent.payment_method) {
        // Fetch card details and update application
        const { data: cardData } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "list_application_payment_methods",
            applicationId,
          },
        });

        if (cardData?.paymentMethods?.[0]) {
          const card = cardData.paymentMethods[0];
          await supabase
            .from("membership_applications")
            .update({
              stripe_customer_id: card.customer,
              stripe_payment_method_id: card.id,
              card_brand: card.card?.brand,
              card_last4: card.card?.last4,
              card_exp_month: card.card?.exp_month,
              card_exp_year: card.card?.exp_year,
            })
            .eq("id", applicationId);
        }

        toast.success("Payment method saved successfully!");
        onSuccess();
      }
    } catch (err) {
      console.error("Error saving card:", err);
      toast.error("Failed to save payment method");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        onReady={() => setIsReady(true)}
        options={{
          layout: "tabs",
        }}
      />
      
      <div className="flex gap-3 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || !elements || isSubmitting || !isReady}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Payment Method"
          )}
        </Button>
      </div>
    </form>
  );
}

export function ApplicationUnderReview({ applicationData }: ApplicationUnderReviewProps) {
  const submittedDate = format(parseISO(applicationData.created_at), "MMMM d, yyyy");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(applicationData.stripe_customer_id || null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [cardOnFile, setCardOnFile] = useState({
    exists: !!applicationData.card_last4,
    brand: applicationData.card_brand,
    last4: applicationData.card_last4,
  });

  const handleAddPaymentMethod = async () => {
    setIsLoadingSetup(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_application_setup",
          applicantEmail: applicationData.email,
          applicantName: applicationData.full_name,
        },
      });

      if (error) throw error;

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setCustomerId(data.customerId);
        setShowPaymentForm(true);
      } else {
        throw new Error("No client secret returned");
      }
    } catch (err) {
      console.error("Error creating setup intent:", err);
      toast.error("Failed to initialize payment form");
    } finally {
      setIsLoadingSetup(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    setClientSecret(null);
    setCardOnFile({
      exists: true,
      brand: null, // Will be updated on next page load
      last4: null,
    });
    // Refresh the page to get updated data
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Storm Wellness Club" className="h-12 w-auto" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Website
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 mb-6">
            <Clock className="w-10 h-10 text-accent" />
          </div>
          <h1 className="heading-section mb-3">Application Under Review</h1>
          <p className="text-muted-foreground text-lg">
            Thank you for your interest in joining Storm Wellness Club, {applicationData.full_name.split(" ")[0]}!
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Application Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground">Membership Plan</span>
              <span className="font-medium">{applicationData.membership_plan}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground">Submitted On</span>
              <span className="font-medium">{submittedDate}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-muted-foreground">Status</span>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium">
                <Clock className="w-4 h-4" />
                Under Review
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cardOnFile.exists ? (
              <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Payment method on file</p>
                  {cardOnFile.brand && cardOnFile.last4 && (
                    <p className="text-sm text-muted-foreground">
                      {cardOnFile.brand.charAt(0).toUpperCase() + cardOnFile.brand.slice(1)} •••• {cardOnFile.last4}
                    </p>
                  )}
                </div>
              </div>
            ) : showPaymentForm && clientSecret ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-muted-foreground">
                    Your card will be saved securely for future billing. No charges will be made until your membership is activated.
                  </p>
                </div>
                <StripeProvider clientSecret={clientSecret}>
                  <PaymentFormInner
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => {
                      setShowPaymentForm(false);
                      setClientSecret(null);
                    }}
                    applicationId={applicationData.id}
                    applicantEmail={applicationData.email}
                    applicantName={applicationData.full_name}
                  />
                </StripeProvider>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-accent" />
                  <div>
                    <p className="font-medium text-foreground">Payment method required</p>
                    <p className="text-sm text-muted-foreground">
                      Please add a payment method to complete your application.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleAddPaymentMethod} 
                  disabled={isLoadingSetup}
                  className="w-full"
                >
                  {isLoadingSetup ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Add Payment Method
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8 bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">What Happens Next?</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium">Application Review</p>
                  <p className="text-muted-foreground text-sm">
                    Our membership team reviews all applications within 2-3 business days.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium">Email Notification</p>
                  <p className="text-muted-foreground text-sm">
                    You'll receive an email once your application has been reviewed.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium">Welcome to Storm</p>
                  <p className="text-muted-foreground text-sm">
                    Upon approval, your member portal will be fully activated.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Questions?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              If you have any questions about your application or membership, please don't hesitate to reach out.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="mailto:membership@stormwellnessclub.com" 
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Mail className="w-4 h-4" />
                membership@stormwellnessclub.com
              </a>
              <a 
                href="tel:+12482328487" 
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Phone className="w-4 h-4" />
                (248) 232-8487
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link to="/">
            <Button variant="outline">
              Explore Our Website
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
