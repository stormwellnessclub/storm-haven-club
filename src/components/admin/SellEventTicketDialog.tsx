import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Ticket, Plus, Trash2, CheckCircle2 } from "lucide-react";

const CLUB_TZ = "America/Detroit";

type PaymentMethod = "card_on_file" | "cash" | "clover" | "external";
type Attendee = { first_name: string; last_name: string; email: string; phone: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    user_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    stripe_customer_id?: string | null;
  };
  onSuccess?: () => void;
}

export function SellEventTicketDialog({ open, onOpenChange, member, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const memberName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  const [eventSlug, setEventSlug] = useState<string>("");
  const [ticketType, setTicketType] = useState<"member" | "non_member">("member");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card_on_file");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([
    { first_name: "", last_name: "", email: "", phone: "" },
  ]);
  const [issued, setIssued] = useState<{ count: number; totalCents: number } | null>(null);

  const { data: events } = useQuery({
    queryKey: ["admin-sell-events-on-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, member_price_cents, non_member_price_cents, status")
        .eq("status", "on_sale")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const selectedEvent = (events || []).find((e: any) => e.slug === eventSlug);

  useEffect(() => {
    if (open && events && events.length > 0 && !eventSlug) {
      setEventSlug(events[0].slug);
    }
  }, [open, events]);

  const addAttendee = () =>
    setAttendees((prev) => [...prev, { first_name: "", last_name: "", email: "", phone: "" }]);
  const removeAttendee = (i: number) =>
    setAttendees((prev) => prev.filter((_, idx) => idx !== i));
  const updateAttendee = (i: number, patch: Partial<Attendee>) =>
    setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const pricePerCents = selectedEvent
    ? ticketType === "member"
      ? selectedEvent.member_price_cents
      : selectedEvent.non_member_price_cents
    : 0;
  const totalCents = pricePerCents * attendees.length;

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) throw new Error("Select an event");
      for (let i = 0; i < attendees.length; i++) {
        if (!attendees[i].first_name.trim() || !attendees[i].last_name.trim()) {
          throw new Error(`Attendee ${i + 1}: first & last name required`);
        }
      }
      const { data, error } = await supabase.functions.invoke("admin-sell-event-ticket", {
        body: {
          member_id: member.id,
          event_slug: selectedEvent.slug,
          ticket_type: ticketType,
          payment_method: paymentMethod,
          payment_reference: paymentReference.trim() || undefined,
          note: note.trim() || undefined,
          attendees,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Sale failed");
      return { count: attendees.length, totalCents: data.totalCents || totalCents };
    },
    onSuccess: (result) => {
      setIssued(result);
      toast.success(`${result.count} ticket(s) sold`);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-event", eventSlug] });
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setEventSlug("");
    setTicketType("member");
    setPaymentMethod("card_on_file");
    setPaymentReference("");
    setNote("");
    setAttendees([{ first_name: "", last_name: "", email: "", phone: "" }]);
    setIssued(null);
  };
  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Sell Event Tickets
          </DialogTitle>
          <DialogDescription>
            Charge {memberName || "this member"} for one or more event tickets. Add each attendee to the roster.
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Sale complete</div>
              <div className="mt-1 text-3xl font-bold">{fmt(issued.totalCents)}</div>
              <div className="text-sm text-muted-foreground">{issued.count} ticket(s) added to the roster</div>
            </div>
            <DialogFooter>
              <Button onClick={close} className="w-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Event</Label>
                <Select value={eventSlug} onValueChange={setEventSlug}>
                  <SelectTrigger><SelectValue placeholder="Choose event" /></SelectTrigger>
                  <SelectContent>
                    {(events || []).map((e: any) => (
                      <SelectItem key={e.slug} value={e.slug}>
                        {e.title} — {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "MMM d, h:mm a")}
                      </SelectItem>
                    ))}
                    {(!events || events.length === 0) && (
                      <div className="p-3 text-sm text-muted-foreground">No events on sale</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedEvent && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ticket type</Label>
                    <Select value={ticketType} onValueChange={(v) => setTicketType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member — {fmt(selectedEvent.member_price_cents)}</SelectItem>
                        <SelectItem value="non_member">Non-Member — {fmt(selectedEvent.non_member_price_cents)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Payment method</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card_on_file" disabled={!member.stripe_customer_id}>
                          Charge card on file{!member.stripe_customer_id ? " (no card)" : ""}
                        </SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="clover">Clover</SelectItem>
                        <SelectItem value="external">External / Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {paymentMethod !== "card_on_file" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
                  <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Clover txn ID, cash drawer #, etc." />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Internal note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Staff-only note" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Attendees ({attendees.length})</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addAttendee}>
                    <Plus className="h-3 w-3 mr-1" /> Add attendee
                  </Button>
                </div>
                {attendees.map((a, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Attendee {i + 1}
                      </div>
                      {attendees.length > 1 && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeAttendee(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">First name *</Label>
                        <Input value={a.first_name} onChange={(e) => updateAttendee(i, { first_name: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Last name *</Label>
                        <Input value={a.last_name} onChange={(e) => updateAttendee(i, { last_name: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Email (optional — sends confirmation)</Label>
                        <Input type="email" value={a.email} onChange={(e) => updateAttendee(i, { email: e.target.value })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Phone (optional)</Label>
                        <Input value={a.phone} onChange={(e) => updateAttendee(i, { phone: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedEvent && (
                <div className="rounded-md border bg-muted/50 p-3">
                  <div className="flex justify-between text-sm">
                    <span>{attendees.length} × {fmt(pricePerCents)}</span>
                    <span className="font-semibold">{fmt(totalCents)}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={sellMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => sellMutation.mutate()}
                disabled={sellMutation.isPending || !selectedEvent || attendees.length === 0}
              >
                {sellMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing…</>
                ) : (
                  <><Ticket className="h-4 w-4 mr-1" /> Charge {fmt(totalCents)}</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
