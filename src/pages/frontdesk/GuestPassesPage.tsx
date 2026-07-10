import { useState, useEffect } from "react";
import { FrontDeskShell } from "./FrontDeskShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Ticket, CheckCircle2 } from "lucide-react";

const GUEST_PASS_PRICE = 60;

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number?: string | null;
  status: "active" | "exhausted" | "expired";
  valid_date?: string | null;
  used_at: string | null;
}

/**
 * /frontdesk/guest-passes — operational-only view.
 *
 * Front desk can:
 *  - See today's guest passes and mark them used
 *  - Sell a single guest pass at fixed price
 *
 * No revenue totals, no cohort stats, no discount toggle, no bulk sale.
 */
export default function FrontDeskGuestPassesPage() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [loading, setLoading] = useState(false);

  // sell form
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [visitDate, setVisitDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [submitting, setSubmitting] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const fetchPasses = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("guest_passes" as any)
      .select("id, guest_name, guest_email, phone_number, status, valid_date, used_at")
      .eq("valid_date", todayStr)
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success") {
      toast.success("Guest pass purchased!");
      window.history.replaceState({}, "", "/frontdesk/guest-passes");
    } else if (params.get("purchase") === "cancelled") {
      toast.error("Payment cancelled");
      window.history.replaceState({}, "", "/frontdesk/guest-passes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSell = async () => {
    if (!guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_guest_pass_checkout",
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          validDate: visitDate,
          quantity: 1,
          successUrl: `${origin}/frontdesk/guest-passes?purchase=success`,
          cancelUrl: `${origin}/frontdesk/guest-passes?purchase=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to start checkout");
      setSubmitting(false);
    }
  };

  const markUsed = async (pass: GuestPass) => {
    const { error } = await (supabase
      .from("guest_passes" as any)
      .update({ used_at: new Date().toISOString(), status: "exhausted", checked_in_by: user?.id })
      .eq("id", pass.id) as any);
    if (error) {
      toast.error(error.message || "Failed to check in");
      return;
    }
    toast.success(`${pass.guest_name} checked in`);
    fetchPasses();
  };

  return (
    <FrontDeskShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guest Passes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Check in today's guests or sell a new pass.
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
              <CardDescription>{format(new Date(), "EEEE, MMM d")}</CardDescription>
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
                    const used = !!p.used_at;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{p.guest_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.guest_email || p.phone_number || "—"}
                          </div>
                        </div>
                        {used ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Checked in
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
              <CardDescription>${GUEST_PASS_PRICE} · one guest, one day</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Button className="w-full" onClick={handleSell} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Charge ${GUEST_PASS_PRICE} & continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </FrontDeskShell>
  );
}
