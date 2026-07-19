import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
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

  if (!event) return null;

  const memberPrice = (event.member_price_cents / 100).toFixed(0);
  const nonMemberPrice = (event.non_member_price_cents / 100).toFixed(0);
  const maxQty = 6;

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
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Could not start checkout");
      }
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d · h:mm a 'ET'")}
            {event.venue ? ` · ${event.venue}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Members</span>
            <span className="font-medium">${memberPrice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Non-Members</span>
            <span className="font-medium">${nonMemberPrice}</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Member rate is applied automatically at checkout if your email matches an active membership.
          </p>
        </div>

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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleCheckout} disabled={submitting}>
            {submitting ? "Redirecting…" : "Continue to secure checkout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
