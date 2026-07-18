import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CLUB_TZ = "America/Detroit";

export default function EventPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, description, starts_at, venue, capacity, status, member_price_cents, non_member_price_cents, image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: availability } = useQuery({
    queryKey: ["event-availability", slug],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_event_availability", { _slug: slug });
      return data?.[0] ?? null;
    },
    refetchInterval: 30000,
    enabled: !!slug,
  });

  const remaining = availability?.remaining ?? 0;
  const soldOut = event?.status === "sold_out" || (availability && remaining <= 0);

  const handleCheckout = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-event-ticket-checkout", {
        body: {
          slug,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
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

  if (isLoading) {
    return <div className="max-w-3xl mx-auto p-6 space-y-4"><Skeleton className="h-64" /></div>;
  }
  if (!event) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <Card className="overflow-hidden">
        {event.image_url && (
          <div className="h-56 w-full bg-muted">
            <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
          </div>
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl md:text-3xl">{event.title}</CardTitle>
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d, yyyy · h:mm a 'ET'")}
                </span>
                {event.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {event.venue}
                  </span>
                )}
              </div>
            </div>
            <Badge variant={soldOut ? "destructive" : "default"} className="shrink-0">
              {soldOut ? "Sold Out" : `${remaining} left`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {event.description && (
            <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Members</div>
              <div className="text-2xl font-semibold">${(event.member_price_cents / 100).toFixed(0)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Non-Members</div>
              <div className="text-2xl font-semibold">${(event.non_member_price_cents / 100).toFixed(0)}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            We'll automatically apply your member rate at checkout if your email matches an active membership.
          </p>

          {!soldOut && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Ticket className="h-4 w-4" /> Reserve your seat
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    max={Math.min(6, remaining)}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  />
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={handleCheckout} disabled={submitting}>
                {submitting ? "Redirecting to checkout…" : "Buy tickets"}
              </Button>
            </div>
          )}

          {soldOut && (
            <div className="border-t pt-6 text-center text-muted-foreground">
              This event is sold out. Reach out to concierge to join the waitlist.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
