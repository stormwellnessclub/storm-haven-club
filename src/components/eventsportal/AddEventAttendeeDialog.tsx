import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonSearch, PersonResult } from "@/components/admin/roster/PersonSearch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  canOverride: boolean;
  onAdded: () => void;
}

export function AddEventAttendeeDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  canOverride,
  onAdded,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PersonResult | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [ticketType, setTicketType] = useState<"member" | "non_member">("member");
  const [payment, setPayment] = useState<"comp" | "cash" | "clover" | "external">("comp");
  const [amount, setAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSearch("");
    setSelected(null);
    setFirst("");
    setLast("");
    setEmail("");
    setPhone("");
    setUserId(null);
    setTicketType("member");
    setPayment("comp");
    setAmount("");
    setPaymentNote("");
    setOverride(false);
    setOverrideReason("");
    setNotify(false);
  };

  const pick = (p: PersonResult) => {
    setSelected(p);
    const parts = p.name.split(" ");
    setFirst(parts[0] ?? "");
    setLast(parts.slice(1).join(" "));
    setEmail(p.email);
    setPhone(p.phone);
    setUserId(p.userId);
    setTicketType(p.type === "member" ? "member" : "non_member");
    setSearch("");
  };

  const submit = async () => {
    if (!first.trim() || !last.trim()) {
      toast.error("Please enter a first and last name.");
      return;
    }
    if (override && !overrideReason.trim()) {
      toast.error("Please give a short reason for the override.");
      return;
    }
    setSaving(true);
    try {
      const cents =
        payment === "comp" ? 0 : Math.round(parseFloat(amount || "0") * 100) || 0;
      const { data, error } = await supabase.rpc("admin_add_event_attendee" as any, {
        _event_id: eventId,
        _first_name: first.trim(),
        _last_name: last.trim(),
        _email: email.trim() || null,
        _phone: phone.trim() || null,
        _user_id: userId,
        _ticket_type: ticketType,
        _amount_cents: cents,
        _payment_note:
          payment === "comp" ? "Complimentary" : `${payment}${paymentNote ? ` — ${paymentNote}` : ""}`,
        _override: override,
        _override_reason: overrideReason.trim() || null,
      });
      if (error) throw error;
      const res = data as { ok?: boolean; reason?: string; ticket_id?: string } | null;
      if (!res?.ok) {
        if (res?.reason === "full")
          toast.error("This event is at capacity. Use the override to seat them anyway.");
        else if (res?.reason === "not_authorized")
          toast.error("You don't have permission to add people to events.");
        else toast.error("We could not add them. Please try again.");
        return;
      }
      if (notify && res.ticket_id) {
        supabase.functions
          .invoke("send-event-reservation-email", {
            body: { ticket_id: res.ticket_id, kind: "reservation" },
          })
          .catch(() => undefined);
      }
      toast.success(`${first.trim()} ${last.trim()} added to ${eventTitle}.`);
      reset();
      onOpenChange(false);
      onAdded();
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add someone to this event</DialogTitle>
          <DialogDescription>
            Search for a member or non-member, or enter a guest who isn't in the system yet.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="search" className="space-y-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="manual">Not in the system</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3">
            <PersonSearch search={search} onSearchChange={setSearch} onSelect={pick} />
            {selected && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{selected.name}</p>
                <p className="text-muted-foreground text-xs">
                  {selected.email || "No email on file"}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter their details below — they'll be seated as a guest.
            </p>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="att-first">First name</Label>
              <Input id="att-first" value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-last">Last name</Label>
              <Input id="att-last" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="att-email">Email</Label>
              <Input
                id="att-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-phone">Phone</Label>
              <Input id="att-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Attending as</Label>
              <Select value={ticketType} onValueChange={(v) => setTicketType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="non_member">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>How it's recorded</Label>
              <Select value={payment} onValueChange={(v) => setPayment(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comp">Complimentary</SelectItem>
                  <SelectItem value="cash">Paid — cash</SelectItem>
                  <SelectItem value="clover">Paid — Clover</SelectItem>
                  <SelectItem value="external">Paid — other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {payment !== "comp" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="att-amount">Amount paid ($)</Label>
                <Input
                  id="att-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="30.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="att-ref">Reference</Label>
                <Input
                  id="att-ref"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Receipt #"
                />
              </div>
            </div>
          )}

          {canOverride && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="att-override">Override</Label>
                  <p className="text-xs text-muted-foreground">
                    Seat them past capacity or outside the usual membership level.
                  </p>
                </div>
                <Switch id="att-override" checked={override} onCheckedChange={setOverride} />
              </div>
              {override && (
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for the override"
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="att-notify"
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
            />
            <Label htmlFor="att-notify" className="text-sm font-normal">
              Send them the confirmation email
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Add to event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
