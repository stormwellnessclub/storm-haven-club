import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Ticket } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export function EventAnnouncementBanner() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);

  const { data: event } = useQuery({
    queryKey: ["upcoming-event-banner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, venue, member_price_cents, non_member_price_cents")
        .eq("status", "on_sale")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: avail } = useQuery({
    queryKey: ["upcoming-event-availability", event?.slug],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_event_availability", { _slug: event!.slug });
      return data?.[0] ?? null;
    },
    enabled: !!event?.slug,
    staleTime: 30_000,
  });

  // Prefill from auth + profile when dialog opens
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
        .eq("id", user.id)
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

  const remaining = (avail as any)?.remaining ?? null;
  const memberPrice = (event.member_price_cents / 100).toFixed(0);
  const nonMemberPrice = (event.non_member_price_cents / 100).toFixed(0);
  const soldOut = remaining === 0;
  const maxQty = Math.min(6, remaining ?? 6);

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
    <>
      <Card className="relative overflow-hidden border-gold/40 bg-gradient-to-br from-gold/15 via-background to-accent/10 shadow-lg">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gold/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6">
          <div className="h-14 w-14 rounded-full bg-gold/20 flex items-center justify-center shrink-0 ring-1 ring-gold/30">
            <Sparkles className="h-7 w-7 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-gold font-semibold mb-1">
              Upcoming Event
            </div>
            <h3 className="font-serif text-xl sm:text-2xl leading-tight text-foreground">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d · h:mm a 'ET'")}
              {event.venue ? ` · ${event.venue}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-background/70 border border-border/60 text-foreground">
                Members ${memberPrice}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-background/70 border border-border/60 text-foreground">
                Guests ${nonMemberPrice}
              </span>
              {remaining !== null && remaining > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gold/20 border border-gold/40 text-foreground font-medium">
                  {remaining} seat{remaining === 1 ? "" : "s"} left
                </span>
              )}
              {soldOut && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-destructive font-medium">
                  Sold out
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button asChild size="lg" variant="outline" className="border-gold/40">
              <Link to={`/events/${event.slug}`}>More info</Link>
            </Button>
            <Button
              size="lg"
              variant="gold"
              disabled={soldOut}
              onClick={() => setOpen(true)}
            >
              <Ticket className="h-4 w-4 mr-1" />
              Buy Tickets
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
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
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleCheckout} disabled={submitting || soldOut}>
              {submitting ? "Redirecting…" : "Continue to secure checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
