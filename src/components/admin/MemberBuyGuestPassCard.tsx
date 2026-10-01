import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, Loader2, CreditCard } from "lucide-react";
import { POSCustomerSearch, POSCustomer } from "@/components/admin/POSCustomerSearch";

const GUEST_PASS_PRICE = 60;

interface Props {
  memberId: string;
  memberName: string;
  stripeCustomerId: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  adminUserId: string | undefined;
  onPurchased?: () => void;
}

/** Member pays (card on file) for a guest pass issued to a registered non-member. */
export function MemberBuyGuestPassCard({ memberId, memberName, stripeCustomerId, cardBrand, cardLast4, adminUserId, onPurchased }: Props) {
  const [guest, setGuest] = useState<POSCustomer | null>(null);
  const [price, setPrice] = useState<number>(GUEST_PASS_PRICE);
  const [busy, setBusy] = useState(false);

  const fee = price > 0 ? price * 0.029 + 0.3 : 0;
  const total = price + fee;
  const hasCard = !!(stripeCustomerId && cardLast4);

  const handleSelect = (c: POSCustomer | null) => {
    if (c && c.type !== "non_member") {
      toast.error("Choose a registered non-member account");
      return;
    }
    setGuest(c);
  };

  const buy = async () => {
    if (!guest || !adminUserId || !stripeCustomerId) return;
    setBusy(true);
    try {
      let paymentIntentId: string | null = null;
      if (total > 0) {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            memberId,
            stripeCustomerId,
            amount: Math.round(total * 100),
            description: `Guest Pass for ${guest.name} – paid by ${memberName}`,
          },
        });
        if (error) throw error;
        if (data?.error || data?.success === false) throw new Error(data?.error || "Card was declined");
        paymentIntentId = data?.paymentIntentId || data?.payment_intent_id || null;
      }

      let phone: string | null = null;
      if (guest.userId) {
        const { data: nm } = await supabase.from("non_member_profiles").select("phone").eq("user_id", guest.userId).maybeSingle();
        phone = nm?.phone ?? null;
      }
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      const { error: insErr } = await supabase.from("guest_passes").insert({
        guest_name: guest.name,
        guest_email: guest.email || null,
        phone_number: phone,
        price_paid: price,
        status: "active",
        purchased_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
        sold_by: adminUserId,
        stripe_payment_id: paymentIntentId,
        stripe_customer_id: stripeCustomerId,
        user_id: guest.userId ?? null,
        referring_member_id: memberId,
        member_referral: memberName,
        admin_notes: `Paid by member ${memberName}`,
      } as any);
      if (insErr) {
        console.error(insErr);
        toast.error("The member's card was charged, but the pass wasn't created. Please contact support.");
        return;
      }
      toast.success(`Guest pass created for ${guest.name}`);
      setGuest(null);
      setPrice(GUEST_PASS_PRICE);
      onPurchased?.();
    } catch (e: any) {
      toast.error(e?.message || "Could not complete the purchase");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" />Buy Guest Pass for a Non-Member</CardTitle>
        <CardDescription>Charge this member's card for a guest pass issued to a registered non-member.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Guest (non-member)</Label>
          <POSCustomerSearch selected={guest} onSelect={handleSelect} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Price per pass $</Label>
          <Input type="number" min={0} className="w-24 h-8" value={price} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))} />
        </div>
        <div className="text-xs text-muted-foreground">
          Est. total ${total.toFixed(2)} (incl. ~${fee.toFixed(2)} processing). Valid 30 days.
        </div>
        {hasCard ? (
          <Button className="w-full" size="sm" disabled={!guest || busy} onClick={buy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
            Charge {cardBrand || "card"} •••• {cardLast4}
          </Button>
        ) : (
          <p className="text-xs text-destructive">This member has no card on file.</p>
        )}
      </CardContent>
    </Card>
  );
}
