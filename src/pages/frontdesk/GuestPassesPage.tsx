import { useState, useEffect } from "react";
import { FrontDeskShell } from "./FrontDeskShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { guestCheckInPatch, isGuestPassCheckedIn, guestVisitDateLabel } from "@/lib/guestPassStatus";
import { format } from "date-fns";
import {
  Loader2,
  Ticket,
  CheckCircle2,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const GUEST_PASS_PRICE = 60;

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number?: string | null;
  status: string;
  valid_date?: string | null;
  used_at: string | null;
}

interface GuestInfo {
  guestName: string;
  guestEmail: string;
  phoneNumber: string;
  visitDate: string;
}

/** Inline card form using Stripe PaymentElement (no redirect off-site). */
function InlineCardCharge({
  guestInfo,
  totalCents,
  onSuccess,
  onCancel,
}: {
  guestInfo: GuestInfo;
  totalCents: number;
  onSuccess: (paymentIntentId: string, customerId: string | null) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
          receipt_email: guestInfo.guestEmail || undefined,
          payment_method_data: {
            billing_details: {
              name: guestInfo.guestName || undefined,
              email: guestInfo.guestEmail || undefined,
              phone: guestInfo.phoneNumber || undefined,
            },
          },
        },
        redirect: "if_required",
      });
      if (error) {
        toast.error(error.message || "Card declined");
        setSubmitting(false);
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        const customerId =
          ((paymentIntent as any)?.customer as string | null) ?? null;
        onSuccess(paymentIntent.id, customerId);
      } else {
        toast.error(`Payment status: ${paymentIntent?.status || "unknown"}`);
        setSubmitting(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to charge card");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="border rounded-lg p-3 bg-background">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className="flex-1"
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Charge ${(totalCents / 100).toFixed(2)}
        </Button>
      </div>
    </form>
  );
}

/**
 * /frontdesk/guest-passes — operational-only view.
 *
 * Front desk can:
 *  - See today's guest passes and mark them used
 *  - Sell a guest pass on-site with Cash / Clover / Card (no redirect)
 */
export default function FrontDeskGuestPassesPage() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [loading, setLoading] = useState(false);

  // sell form
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [visitDate, setVisitDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [payMethod, setPayMethod] = useState<"cash" | "clover" | "card">(
    "cash",
  );
  const [submitting, setSubmitting] = useState(false);

  // card flow state
  const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
  const [cardTotalCents, setCardTotalCents] = useState<number>(0);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const subtotalCents = GUEST_PASS_PRICE * 100;
  const estFeeCents =
    payMethod === "card"
      ? Math.round(subtotalCents / (1 - 0.029) + 30 / (1 - 0.029)) -
        subtotalCents
      : 0;
  const totalCents = subtotalCents + estFeeCents;

  const fetchPasses = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("guest_passes" as any)
      .select(
        "id, guest_name, guest_email, phone_number, status, valid_date, used_at, purchased_at",
      )
      .or(`valid_date.eq.${todayStr},and(valid_date.is.null,purchased_at.gte.${todayStr}T00:00:00)`)
      .order("guest_name", { ascending: true }) as any);
    setLoading(false);
    if (error) {
      toast.error("Failed to load today's passes");
      return;
    }
    setPasses((data || []) as GuestPass[]);
  };

  useEffect(() => {
    fetchPasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setGuestName("");
    setGuestEmail("");
    setPhoneNumber("");
    setVisitDate(format(new Date(), "yyyy-MM-dd"));
    setPayMethod("cash");
    setCardClientSecret(null);
    setCardTotalCents(0);
  };

  const insertPass = async (opts: {
    paymentMethod: "cash" | "clover" | "card";
    stripePaymentId?: string | null;
    stripeCustomerId?: string | null;
    pricePaid: number;
  }) => {
    const { error } = await (supabase.from("guest_passes" as any).insert({
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim() || null,
      phone_number: phoneNumber.trim() || null,
      valid_date: visitDate,
      price_paid: opts.pricePaid,
      status: "active",
      purchased_at: new Date().toISOString(),
      sold_by: user?.id,
      payment_method: opts.paymentMethod,
      stripe_payment_id: opts.stripePaymentId ?? null,
      stripe_customer_id: opts.stripeCustomerId ?? null,
    }) as any);
    if (error) throw error;
  };

  const handleSell = async () => {
    if (!guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    setSubmitting(true);

    try {
      if (payMethod === "cash" || payMethod === "clover") {
        await insertPass({
          paymentMethod: payMethod,
          pricePaid: GUEST_PASS_PRICE,
        });
        toast.success(
          `Guest pass sold — paid via ${payMethod === "cash" ? "cash" : "Clover"}`,
        );
        resetForm();
        fetchPasses();
        setSubmitting(false);
        return;
      }

      // Card: create PaymentIntent, then mount inline PaymentElement
      const { data, error } = await supabase.functions.invoke(
        "stripe-payment",
        {
          body: {
            action: "create_guest_pass_payment_intent",
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim() || undefined,
            phoneNumber: phoneNumber.trim() || undefined,
            subtotalCents,
            includeProcessingFee: true,
          },
        },
      );
      if (error) throw error;
      if (!data?.clientSecret) throw new Error("Failed to initialize card form");
      setCardClientSecret(data.clientSecret);
      setCardTotalCents(data.totalCents ?? totalCents);
    } catch (err: any) {
      toast.error(err?.message || "Failed to sell pass");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardSuccess = async (
    paymentIntentId: string,
    customerId: string | null,
  ) => {
    try {
      await insertPass({
        paymentMethod: "card",
        stripePaymentId: paymentIntentId,
        stripeCustomerId: customerId,
        pricePaid: GUEST_PASS_PRICE,
      });
      toast.success("Guest pass sold — card charged");
      resetForm();
      fetchPasses();
    } catch (err: any) {
      toast.error(
        `Payment succeeded but failed to save pass: ${err?.message || err}`,
      );
    }
  };

  const markUsed = async (pass: GuestPass) => {
    const { ok, error } = await checkInGuestPass(supabase, pass.id, user?.id);
    if (!ok) {
      toast.error(error || "Failed to check in");
      return;
    }
    toast.success(`${pass.guest_name} checked in`);
    fetchPasses();
  };


  return (
    <FrontDeskShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Guest Passes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Check in today's guests or sell a new pass — right here, no
            redirect.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Today's passes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5" />
                Today's Passes
              </CardTitle>
              <CardDescription>
                {format(new Date(), "EEEE, MMM d")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : passes.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No guests scheduled for today.
                </div>
              ) : (
                <div className="space-y-2">
                  {passes.map((p) => {
                    const used = isGuestPassCheckedIn(p);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {p.guest_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.guest_email || p.phone_number || "—"}
                          </div>
                        </div>
                        {used ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Checked in · {guestVisitDateLabel(p)}
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => markUsed(p)}>
                            Check in
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sell a pass */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sell a Guest Pass</CardTitle>
              <CardDescription>
                ${GUEST_PASS_PRICE} · one guest, one day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!cardClientSecret && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="gn">Guest name *</Label>
                    <Input
                      id="gn"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ge">Email</Label>
                    <Input
                      id="ge"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gp">Phone</Label>
                    <Input
                      id="gp"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vd">Visit date</Label>
                    <Input
                      id="vd"
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Payment method</Label>
                    <Tabs
                      value={payMethod}
                      onValueChange={(v) => setPayMethod(v as any)}
                    >
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="cash" className="gap-1">
                          <Banknote className="h-4 w-4" /> Cash
                        </TabsTrigger>
                        <TabsTrigger value="clover" className="gap-1">
                          <Smartphone className="h-4 w-4" /> Clover
                        </TabsTrigger>
                        <TabsTrigger value="card" className="gap-1">
                          <CreditCard className="h-4 w-4" /> Card
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent
                        value="cash"
                        className="text-xs text-muted-foreground pt-2"
                      >
                        Collect ${GUEST_PASS_PRICE} in cash. Recorded as a cash
                        sale — no card charge.
                      </TabsContent>
                      <TabsContent
                        value="clover"
                        className="text-xs text-muted-foreground pt-2"
                      >
                        Charge on the Clover terminal, then log the sale here.
                        No Stripe charge.
                      </TabsContent>
                      <TabsContent
                        value="card"
                        className="text-xs text-muted-foreground pt-2"
                      >
                        Enter the guest's card securely on the next step.
                        Processing fee added: est. total{" "}
                        <span className="font-medium">
                          ${(totalCents / 100).toFixed(2)}
                        </span>
                        .
                      </TabsContent>
                    </Tabs>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSell}
                    disabled={submitting}
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {payMethod === "card"
                      ? `Continue to card entry`
                      : `Record ${payMethod === "cash" ? "Cash" : "Clover"} sale — $${GUEST_PASS_PRICE}`}
                  </Button>
                </>
              )}

              {cardClientSecret && (
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Charging: </span>
                    <span className="font-medium">{guestName}</span>
                  </div>
                  <StripeProvider clientSecret={cardClientSecret}>
                    <InlineCardCharge
                      guestInfo={{
                        guestName,
                        guestEmail,
                        phoneNumber,
                        visitDate,
                      }}
                      totalCents={cardTotalCents}
                      onSuccess={handleCardSuccess}
                      onCancel={() => {
                        setCardClientSecret(null);
                        setCardTotalCents(0);
                      }}
                    />
                  </StripeProvider>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FrontDeskShell>
  );
}
