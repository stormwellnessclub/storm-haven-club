import { useEffect, useMemo, useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StripeProvider } from "@/components/StripeProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Loader2, Ticket, Trash2 } from "lucide-react";


const CLUB_TZ = "America/Detroit";

export interface BuyTicketsDialogEvent {
  slug: string;
  title: string;
  starts_at: string;
  venue?: string | null;
  member_price_cents: number;
  non_member_price_cents: number;
}

interface Props {
  event: BuyTicketsDialogEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function BuyTicketsDialog({ event, open, onOpenChange }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "payment" | "success">("details");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [checkoutSummary, setCheckoutSummary] = useState<{
    ticketType: string;
    quantity: number;
    totalCents: number;
    tickets?: Array<any>;
  } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  type Attendee = { first_name: string; last_name: string; email: string; phone: string };
  const [attendees, setAttendees] = useState<Attendee[]>([
    { first_name: "", last_name: "", email: "", phone: "" },
  ]);


  useEffect(() => {
    if (!open) return;
    setStep("details");
    setClientSecret(null);
    setPaymentIntentId(null);
    setCheckoutSummary(null);
    setSubmitting(false);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      setIsAuthed(!!user);
      if (!user) return;
      setEmail((prev) => prev || user.email || "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) {
        setFirstName((prev) => prev || profile.first_name || "");
        setLastName((prev) => prev || profile.last_name || "");
        setEmail((prev) => prev || profile.email || user.email || "");
        setPhone((prev) => prev || profile.phone || "");
      }
    })();
  }, [open]);

  const eventTime = useMemo(
    () => event ? formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d · h:mm a 'ET'") : "",
    [event]
  );

  if (!event) return null;

  const memberPrice = (event.member_price_cents / 100).toFixed(0);
  const nonMemberPrice = (event.non_member_price_cents / 100).toFixed(0);
  const maxQty = 6;
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleCheckout = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-event-ticket-checkout", {
        body: {
          slug: event.slug,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          quantity,
          embedded: true,
        },
      });
      if (error) throw error;
      if (data?.clientSecret && data?.paymentIntentId) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setCheckoutSummary({
          ticketType: data.ticketType || "event",
          quantity: data.quantity || quantity,
          totalCents: data.totalCents || 0,
        });
        setStep("payment");
      } else {
        throw new Error(data?.error || "Could not start checkout");
      }
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurchaseComplete = (tickets: Array<any>) => {
    setCheckoutSummary((prev) => (prev ? { ...prev, tickets } : prev));
    setStep("success");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:!max-w-4xl">
        <DialogHeader>
          <div className="px-6 pt-6 sm:px-8 sm:pt-8">
            <DialogTitle className="text-2xl font-semibold">{event.title}</DialogTitle>
            <DialogDescription className="mt-2">
            {eventTime}
            {event.venue ? ` · ${event.venue}` : ""}
            </DialogDescription>
          </div>
        </DialogHeader>

        {step === "success" ? (
          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-5 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h3 className="text-xl font-semibold">Purchase successful</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your {checkoutSummary?.quantity || quantity} ticket{(checkoutSummary?.quantity || quantity) > 1 ? "s are" : " is"} confirmed. A confirmation email is being sent to {email}.
              </p>
            </div>
            <div className="mt-4 rounded-lg border p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <Ticket className="h-4 w-4" /> Ticket details
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Event</span>
                  <p className="font-medium">{event.title}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date & time</span>
                  <p className="font-medium">{eventTime}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Name</span>
                  <p className="font-medium">{firstName} {lastName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total paid</span>
                  <p className="font-medium">{formatCurrency(checkoutSummary?.totalCents || 0)}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="gold" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-0 sm:grid-cols-[0.9fr_1.1fr]">
            <aside className="border-y bg-muted/30 p-6 sm:border-b-0 sm:border-r sm:px-8 sm:py-6">
              <div className="rounded-lg border bg-background p-4 text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Members</span>
                  <span className="font-medium">${memberPrice}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Non-Members</span>
                  <span className="font-medium">${nonMemberPrice}</span>
                </div>
                {checkoutSummary ? (
                  <div className="border-t pt-3">
                    <div className="flex justify-between gap-4 text-base">
                      <span className="font-medium">Total</span>
                      <span className="font-semibold">{formatCurrency(checkoutSummary.totalCents)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Member rate is applied automatically if your email matches an active membership.
              </p>
            </aside>

            <section className="p-6 sm:px-8 sm:py-6">
              {step === "details" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>First name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Last name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Email</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Phone (optional)</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxQty}
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter className="mt-5 gap-2 sm:gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button variant="gold" onClick={handleCheckout} disabled={submitting}>
                      {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…</> : "Continue to payment"}
                    </Button>
                  </DialogFooter>
                </>
              ) : clientSecret && paymentIntentId ? (
                <StripeProvider key={clientSecret} clientSecret={clientSecret}>
                  <EmbeddedTicketPayment
                    paymentIntentId={paymentIntentId}
                    totalCents={checkoutSummary?.totalCents || 0}
                    eventSlug={event.slug}
                    isAuthed={isAuthed}
                    onBack={() => setStep("details")}
                    onComplete={handlePurchaseComplete}
                  />
                </StripeProvider>
              ) : null}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmbeddedTicketPayment({
  paymentIntentId,
  totalCents,
  eventSlug,
  isAuthed,
  onBack,
  onComplete,
}: {
  paymentIntentId: string;
  totalCents: number;
  eventSlug: string;
  isAuthed: boolean;
  onBack: () => void;
  onComplete: (tickets: any[]) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    try {
      const returnUrl = isAuthed
        ? `${window.location.origin}/portal/my-tickets?just_purchased=1`
        : `${window.location.origin}/events/${eventSlug}/success?payment_intent_id=${paymentIntentId}`;
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
      if (error) throw new Error(error.message || "Payment could not be completed");
      if (paymentIntent?.status !== "succeeded") {
        throw new Error("Payment was not completed. Please try again.");
      }

      const { data, error: finalizeError } = await supabase.functions.invoke("finalize-event-ticket-payment", {
        body: { payment_intent_id: paymentIntent.id || paymentIntentId },
      });
      if (finalizeError) throw finalizeError;
      if (!data?.paid) throw new Error(data?.error || "Payment was not finalized");
      toast.success("Ticket purchase confirmed");
      onComplete(data.tickets || []);
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <PaymentElement />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onBack} disabled={paying}>Back</Button>
        <Button variant="gold" onClick={handlePay} disabled={!stripe || !elements || paying}>
          {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay $${(totalCents / 100).toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
