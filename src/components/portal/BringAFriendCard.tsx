import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Loader2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { formatTime12h } from "@/lib/timeFormat";
import { toast } from "sonner";

type Credit = { id: string; expires_at: string; status: string; guest_name: string | null; booking_id: string | null; booking_status: string | null; class_name: string | null; session_date: string | null; start_time: string | null };
type Session = { id: string; session_date: string; start_time: string; max_capacity: number; current_enrollment: number; room: string | null; class_types: { name: string } | null };

const longDate = (d: string) => format(parseISO(d), "EEE, MMM d");

/** The Member Movement Edit guest class credit: book one non-member friend into a class. */
export function BringAFriendCard() {
  const qc = useQueryClient();
  const { data: credits = [] } = useQuery({
    queryKey: ["my-seasonal-guest-credits"],
    queryFn: async () => ((await (supabase as any).rpc("my_seasonal_guest_credits")).data ?? []) as Credit[],
  });
  const [open, setOpen] = useState<Credit | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["guest-credit-sessions", open?.id],
    enabled: !!open,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const until = format(parseISO(open!.expires_at), "yyyy-MM-dd");
      const { data } = await supabase.from("class_sessions")
        .select("id, session_date, start_time, max_capacity, current_enrollment, room, class_types(name)")
        .gte("session_date", today).lte("session_date", until)
        .eq("is_cancelled", false).eq("is_hidden", false).eq("is_invite_only", false)
        .order("session_date").order("start_time").limit(200);
      const now = new Date();
      return ((data ?? []) as unknown as Session[]).filter((s) => s.current_enrollment < s.max_capacity && new Date(`${s.session_date}T${s.start_time}`) > now);
    },
  });

  const shown = credits.filter((c) => new Date(c.expires_at) > new Date() || c.status === "redeemed");
  if (shown.length === 0) return null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-seasonal-guest-credits"] });

  async function book() {
    if (!open || !sessionId || busy) return;
    setBusy(true); setErr(null);
    const { data, error } = await (supabase as any).rpc("redeem_seasonal_guest_class_credit", { _credit_id: open.id, _session_id: sessionId, _guest_name: name, _guest_email: email, _guest_phone: phone });
    setBusy(false);
    if (error || !data?.success) { setErr(data?.error ?? "We couldn't book your friend. Please try again."); return; }
    const s = sessions.find((x) => x.id === sessionId)!;
    const date = format(parseISO(s.session_date), "EEEE, MMMM d, yyyy"); const time = formatTime12h(s.start_time);
    const className = s.class_types?.name ?? "Class";
    supabase.functions.invoke("send-email", { body: { type: "booking_confirmation", to: email.trim(), data: { class_name: className, className, date, time, room: s.room ?? undefined, location: s.room || "Storm Wellness Club", instructor: "Storm Wellness Club" } } }).catch(() => {});
    supabase.functions.invoke("send-sms", { body: { to: { phone: phone.trim() }, templateKey: "class-booking-confirmation", variables: { className, date, time }, idempotencyKey: `guest-credit-${data.booking_id}`, metadata: { source: "BringAFriendCard" } } }).catch(() => {});
    toast.success(`${name.trim()} is booked for ${className}.`);
    setOpen(null); setName(""); setEmail(""); setPhone(""); setSessionId(""); refresh();
  }

  async function cancel(c: Credit) {
    if (!confirm("Cancel your friend's spot? Cancelling 24+ hours before class returns your guest credit.")) return;
    const { data } = await (supabase as any).rpc("cancel_seasonal_guest_booking", { _credit_id: c.id });
    if (!data?.success) toast.error(data?.error ?? "Couldn't cancel."); else toast.success(data.forfeit_credit ? "Cancelled. Within 24 hours, so the guest credit was used." : "Cancelled. Your guest credit is available again.");
    refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Bring a friend</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {shown.map((c) => (
          <div key={c.id} className="text-sm space-y-2">
            {c.status === "available" ? (
              <>
                <p>You have 1 guest class to share with a friend who isn't a member. Use by {format(parseISO(c.expires_at), "MMMM d, yyyy")}.</p>
                <Button size="sm" onClick={() => { setOpen(c); setErr(null); }}>Book a class for a friend</Button>
              </>
            ) : (
              <>
                <p><span className="font-medium">{c.guest_name}</span>{c.class_name ? ` — ${c.class_name}, ${longDate(c.session_date!)} at ${formatTime12h(c.start_time!)}` : ""}</p>
                {c.booking_status === "confirmed" && <Button size="sm" variant="outline" onClick={() => cancel(c)}>Cancel friend's spot</Button>}
                {c.booking_status !== "confirmed" && <p className="text-muted-foreground">Guest class used.</p>}
              </>
            )}
          </div>
        ))}
      </CardContent>
      <Sheet open={!!open} onOpenChange={(v) => { if (!v && !busy) setOpen(null); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <div className="px-2 pb-6 space-y-4">
            <SheetHeader><SheetTitle>Book a class for a friend</SheetTitle><SheetDescription>Uses your guest class. Your friend must not be a member.</SheetDescription></SheetHeader>
            <div className="space-y-2">
              <Label>Class</Label>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : sessions.length === 0 ? <p className="text-sm text-muted-foreground">No classes with open spots before your guest class expires.</p> : (
                <div className="max-h-56 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {sessions.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSessionId(s.id)} className={`w-full text-left px-3 py-2 text-sm ${sessionId === s.id ? "bg-accent" : ""}`}>
                      <span className="font-medium">{s.class_types?.name ?? "Class"}</span> — {longDate(s.session_date)}, {formatTime12h(s.start_time)}
                      <span className="text-muted-foreground"> · {s.max_capacity - s.current_enrollment} open</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1"><Label htmlFor="gf-name">Friend's name</Label><Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="gf-email">Friend's email</Label><Input id="gf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="gf-phone">Friend's phone</Label><Input id="gf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Your friend will need to sign the club waiver at the front desk before class. Grip socks are required.</p>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button className="w-full" disabled={!sessionId || busy} onClick={book}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book my friend"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
