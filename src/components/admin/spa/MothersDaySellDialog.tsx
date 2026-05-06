import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSpaServices } from "@/hooks/useSpaManagement";

type Gender = "female" | "male" | "prefer_not_to_say";

export function MothersDaySellDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: services } = useSpaServices();

  const [duration, setDuration] = useState<60 | 90>(60);
  const [serviceName, setServiceName] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [buyerFirst, setBuyerFirst] = useState("");
  const [buyerLast, setBuyerLast] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerGender, setBuyerGender] = useState<Gender | "">("");
  const [recipFirst, setRecipFirst] = useState("");
  const [recipLast, setRecipLast] = useState("");
  const [recipEmail, setRecipEmail] = useState("");
  const [recipPhone, setRecipPhone] = useState("");
  const [recipGender, setRecipGender] = useState<Gender | "">("");
  const [giftMessage, setGiftMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const massageOptions = useMemo(
    () =>
      (services || [])
        .filter((s: any) => s.category === "Massage" && s.is_active && s.duration_minutes === duration)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price)),
    [services, duration]
  );

  const selected = massageOptions.find((m: any) => m.name === serviceName) || massageOptions[0];
  const baseCents = selected ? Math.round(Number(selected.price) * 100) : 0;

  const reset = () => {
    setDuration(60); setServiceName(""); setIsGift(false);
    setBuyerFirst(""); setBuyerLast(""); setBuyerEmail(""); setBuyerPhone(""); setBuyerGender("");
    setRecipFirst(""); setRecipLast(""); setRecipEmail(""); setRecipPhone(""); setRecipGender("");
    setGiftMessage(""); setPaymentMethod("cash"); setAdminNotes(""); setSendEmail(true);
  };

  const submit = async () => {
    if (!selected) return toast.error("Choose a massage");
    if (!buyerFirst.trim() || !buyerLast.trim()) return toast.error("Buyer name required");
    if (!buyerEmail.trim()) return toast.error("Buyer email required");
    if (!buyerPhone.trim()) return toast.error("Buyer phone required");
    if (!buyerGender) return toast.error("Buyer gender required");
    if (isGift) {
      if (!recipFirst.trim() || !recipLast.trim()) return toast.error("Recipient name required");
      if (!recipEmail.trim()) return toast.error("Recipient email required");
      if (!recipGender) return toast.error("Recipient gender required");
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mothers-day-admin-sell", {
        body: {
          buyer_first_name: buyerFirst,
          buyer_last_name: buyerLast,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          buyer_gender: buyerGender,
          is_gift: isGift,
          recipient_first_name: isGift ? recipFirst : null,
          recipient_last_name: isGift ? recipLast : null,
          recipient_email: isGift ? recipEmail : null,
          recipient_phone: isGift ? recipPhone : null,
          recipient_gender: isGift ? recipGender : null,
          gift_message: isGift ? giftMessage : null,
          massage_choice: selected.name,
          massage_duration: duration,
          amount_cents: baseCents,
          payment_method: paymentMethod,
          admin_notes: adminNotes,
          send_email: sendEmail,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Voucher created — code ${(data as any).voucher.code}`);
      qc.invalidateQueries({ queryKey: ["mothers-day-vouchers"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Sell Mother's Day Special (in-house)
          </DialogTitle>
          <DialogDescription>
            Record an in-person sale. Voucher activates immediately and the email is sent automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Duration + service */}
          <div className="grid grid-cols-2 gap-3">
            {[60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d as 60 | 90)}
                className={`border rounded-lg p-3 text-center ${duration === d ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="font-serif text-xl">{d} min</div>
              </button>
            ))}
          </div>

          <div>
            <Label className="mb-2 block">Massage</Label>
            <div className="space-y-1.5">
              {massageOptions.map((m: any) => (
                <label key={m.id} className={`flex items-center justify-between border rounded-lg p-2.5 cursor-pointer ${
                  (selected?.id === m.id) ? "border-primary bg-primary/5" : ""
                }`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={selected?.id === m.id} onChange={() => setServiceName(m.name)} />
                    <span>{m.name.replace(/\s—\s\d+$/, "")}</span>
                  </div>
                  <span className="font-semibold">${Number(m.price).toFixed(0)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Buyer */}
          <div className="border-t pt-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Buyer</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First *</Label><Input value={buyerFirst} onChange={(e) => setBuyerFirst(e.target.value)} /></div>
              <div><Label>Last *</Label><Input value={buyerLast} onChange={(e) => setBuyerLast(e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} /></div>
              <div><Label>Phone *</Label><Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} /></div>
            </div>
            <div>
              <Label>Gender *</Label>
              <RadioGroup value={buyerGender} onValueChange={(v) => setBuyerGender(v as Gender)} className="flex gap-4 mt-1">
                {(["female", "male", "prefer_not_to_say"] as Gender[]).map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={g} /> {g.replace(/_/g, " ")}
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          {/* Gift */}
          <div className="border-t pt-4 space-y-3">
            <label className="flex items-center gap-2">
              <Checkbox checked={isGift} onCheckedChange={(v) => setIsGift(!!v)} />
              <span>This is a gift for someone else</span>
            </label>
            {isGift && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Recipient first *</Label><Input value={recipFirst} onChange={(e) => setRecipFirst(e.target.value)} /></div>
                  <div><Label>Recipient last *</Label><Input value={recipLast} onChange={(e) => setRecipLast(e.target.value)} /></div>
                  <div><Label>Recipient email *</Label><Input type="email" value={recipEmail} onChange={(e) => setRecipEmail(e.target.value)} /></div>
                  <div><Label>Recipient phone</Label><Input value={recipPhone} onChange={(e) => setRecipPhone(e.target.value)} /></div>
                </div>
                <div>
                  <Label>Recipient gender *</Label>
                  <RadioGroup value={recipGender} onValueChange={(v) => setRecipGender(v as Gender)} className="flex gap-4 mt-1">
                    {(["female", "male", "prefer_not_to_say"] as Gender[]).map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value={g} /> {g.replace(/_/g, " ")}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label>Gift message</Label>
                  <Textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={2} />
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="border-t pt-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card_in_person">Card (in person, terminal)</SelectItem>
                    <SelectItem value="card_external">Card (charged externally)</SelectItem>
                    <SelectItem value="comp">Comp (no charge)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="text-sm">
                  <div className="text-muted-foreground">Amount</div>
                  <div className="font-serif text-xl">${(baseCents / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} placeholder="Receipt #, terminal ref, etc." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
              Send voucher email now
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create voucher
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
