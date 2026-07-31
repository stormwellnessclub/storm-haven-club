import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate, parseISO } from "date-fns";
import { PT_FORMAT_LABEL, PtFormat, PtPass } from "@/lib/ptFormat";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetUserId?: string;
  presetUserName?: string;
  presetDate?: string; // yyyy-MM-dd
  onSellPack?: (userId: string, userName: string) => void;
  onBooked?: () => void;
}

interface UserOption {
  id: string;
  email: string;
  name: string;
  isMember: boolean;
  isNonMember?: boolean;
}

const DEFAULT_DURATION: Record<PtFormat, number> = {
  one_on_one: 60,
  reformer_one_on_one: 60,
  semi_private: 45,
};

export function BookPTSessionDialog({
  open, onOpenChange, presetUserId, presetUserName, presetDate, onSellPack, onBooked,
}: Props) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>(presetUserId);
  const [userLabel, setUserLabel] = useState<string | undefined>(presetUserName);
  const [search, setSearch] = useState("");

  const [format, setFormat] = useState<PtFormat>("one_on_one");
  const [passId, setPassId] = useState<string>("");
  const [instructorId, setInstructorId] = useState<string>("");
  const [date, setDate] = useState<string>(presetDate ?? fmtDate(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState<string>("09:00");
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"package" | "unpaid">("package");
  const [rate, setRate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUserId(presetUserId);
      setUserLabel(presetUserName);
      if (presetDate) setDate(presetDate);
      setPaymentMode("package");
      setRate("");
      setErr(null);
    }
  }, [open, presetUserId, presetUserName, presetDate]);

  useEffect(() => {
    setDuration(DEFAULT_DURATION[format]);
    setRate("");
  }, [format]);

  // Customer search
  const { data: users = [] } = useQuery({
    queryKey: ["pt-book-user-search", search],
    enabled: !userId && search.length >= 2,
    queryFn: async (): Promise<UserOption[]> => {
      const [{ data: profiles }, { data: members }, { data: nonMembers }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, full_name")
          .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`).limit(10),
        supabase.from("members").select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`).limit(10),
        supabase.from("non_member_profiles").select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`).limit(10),
      ]);
      const list: UserOption[] = [
        ...(profiles ?? []).map((p: any) => ({ id: p.user_id, email: p.email, name: p.full_name ?? p.email, isMember: false })),
        ...(nonMembers ?? []).map((n: any) => ({ id: n.user_id, email: n.email, name: `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() || n.email, isMember: false, isNonMember: true })),
        ...(members ?? []).map((m: any) => ({ id: m.user_id, email: m.email, name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email, isMember: true })),
      ].filter((u) => u.id);
      return Array.from(new Map(list.map((u) => [u.id, u])).values());
    },
  });

  // Customer's active passes
  const { data: passes = [], isLoading: passesLoading } = useQuery({
    queryKey: ["pt-book-user-passes", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const today = fmtDate(new Date(), "yyyy-MM-dd");
      const { data, error } = await (supabase as any).from("pt_passes")
        .select("*").eq("user_id", userId).eq("status", "active")
        .gt("sessions_remaining", 0).gte("expires_at", today)
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PtPass[];
    },
  });

  const formatPasses = useMemo(() => passes.filter((p) => p.format === format), [passes, format]);

  const { data: singleSessionRates = [] } = useQuery({
    queryKey: ["pt-single-session-rates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pt_packs")
        .select("format, price_cents")
        .eq("is_active", true)
        .eq("sessions", 1)
        .order("price_cents", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ format: PtFormat; price_cents: number }>;
    },
  });

  const defaultRateCents = singleSessionRates.find((pack) => pack.format === format)?.price_cents ?? 0;

  useEffect(() => {
    if (formatPasses.length > 0 && !formatPasses.find((p) => p.id === passId)) {
      setPassId(formatPasses[0].id);
    } else if (formatPasses.length === 0) {
      setPassId("");
    }
  }, [formatPasses, passId]);

  useEffect(() => {
    if (!userId || passesLoading) return;
    setPaymentMode(formatPasses.length === 0 ? "unpaid" : "package");
    setErr(null);
  }, [userId, format, formatPasses.length, passesLoading]);

  useEffect(() => {
    if (paymentMode === "unpaid" && !rate && defaultRateCents > 0) {
      setRate((defaultRateCents / 100).toFixed(2));
    }
  }, [paymentMode, rate, defaultRateCents]);

  // Instructors
  const { data: instructors = [] } = useQuery({
    queryKey: ["pt-instructors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("instructors")
        .select("id, first_name, last_name").eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedPass = formatPasses.find((p) => p.id === passId);
  const unpaidMode = paymentMode === "unpaid";

  async function submit(force = false) {
    setErr(null);
    if (submitting) return;
    if (!force) setConflict(null);
    if (!userId) return toast.error("Pick a customer");
    if (!unpaidMode && !selectedPass) {
      setErr("No active sessions for this format. Sell a pack first, or bill this session later.");
      return;
    }
    const rateCents = Math.round(parseFloat(rate || "0") * 100);
    if (unpaidMode && rateCents <= 0) {
      setErr("Enter the session rate so it can be collected later.");
      return;
    }
    const startsAtLocal = new Date(`${date}T${time}:00`);
    if (isNaN(startsAtLocal.getTime())) return toast.error("Invalid date/time");

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("book_pt_appointment", {
        p_user_id: userId,
        p_format: format,
        p_starts_at: startsAtLocal.toISOString(),
        p_duration_minutes: duration,
        p_instructor_id: instructorId || null,
        p_notes: notes || null,
        p_pass_id: unpaidMode ? null : selectedPass?.id ?? null,
        p_unpaid: unpaidMode,
        p_rate_cents: unpaidMode ? rateCents : 0,
        p_location_id: null,
        p_force: force,
      });
      if (error) throw error;
      const appt = Array.isArray(data) ? data[0] : data;
      setConflict(null);
      toast.success(unpaidMode ? "Session booked · marked unpaid" : "Session booked · 1 deducted");

      // Fire confirmation email (non-blocking)
      supabase.functions.invoke("send-pt-booking-email", {
        body: { appointment_id: appt.id, type: "confirmation" },
      }).catch(() => {});

      qc.invalidateQueries({ queryKey: ["pt-appointments"] });
      qc.invalidateQueries({ queryKey: ["pt-passes"] });
      qc.invalidateQueries({ queryKey: ["my-pt-passes"] });
      qc.invalidateQueries({ queryKey: ["my-pt-appointments"] });
      onBooked?.();
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Booking failed";
      if (msg.includes("NO_SESSIONS")) setErr("No active sessions for this customer. Choose Bill later or sell a package.");
      else if (msg.includes("CONFLICT")) {
        setConflict("That trainer is already booked at this time. Pick another slot, or book anyway to double-book on purpose.");
      } else setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Book PT Session</DialogTitle>
          <DialogDescription>Schedule a session and auto-deduct from the customer's pack.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer */}
          {!userId ? (
            <div className="space-y-2">
              <Label>Customer</Label>
              <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {users.length > 0 && (
                <div className="border rounded-md max-h-44 overflow-y-auto">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => { setUserId(u.id); setUserLabel(`${u.name} (${u.email})`); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email} {u.isMember ? "· Member" : u.isNonMember ? "· Non-member" : ""}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <span>{userLabel ?? "Selected customer"}</span>
                <Button variant="ghost" size="sm" onClick={() => { setUserId(undefined); setUserLabel(undefined); }}>Change</Button>
              </div>
            </div>
          )}

          {/* Active sessions summary */}
          {userId && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <div className="font-medium text-foreground">Active passes</div>
              {passesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
              ) : passes.length === 0 ? (
                <div className="text-destructive">No active PT sessions. Sell a pack first.</div>
              ) : (
                passes.map((p) => (
                  <div key={p.id} className="flex justify-between gap-2">
                    <span>{PT_FORMAT_LABEL[p.format]} — {p.pack_name}</span>
                    <span className="text-muted-foreground">
                      {p.sessions_remaining}/{p.sessions_total} · exp {fmtDate(parseISO(p.expires_at), "MMM d")}
                    </span>
                  </div>
                ))
              )}
              {userId && passes.length === 0 && onSellPack && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => onSellPack(userId, userLabel ?? "")}>
                  Sell a pack
                </Button>
              )}
            </div>
          )}

          {/* Format */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PtFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PT_FORMAT_LABEL) as PtFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pack to deduct</Label>
              <Select value={passId} onValueChange={setPassId} disabled={unpaidMode || formatPasses.length === 0}>
                <SelectTrigger><SelectValue placeholder={unpaidMode ? "Billed later" : formatPasses.length === 0 ? "No active passes" : "Pick pack"} /></SelectTrigger>
                <SelectContent>
                  {formatPasses.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pack_name} — {p.sessions_remaining}/{p.sessions_total} (exp {fmtDate(parseISO(p.expires_at), "MMM d")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

            </div>
          </div>

          {/* Payment handling */}
          <div className="rounded-md border px-3 py-2 space-y-2">
            <Label>Payment</Label>
            <RadioGroup value={paymentMode} onValueChange={(value) => setPaymentMode(value as "package" | "unpaid")}>
              <label className={`flex items-start gap-3 rounded-md border p-3 ${formatPasses.length === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <RadioGroupItem value="package" disabled={formatPasses.length === 0} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Use active package</span>
                  <span className="block text-xs text-muted-foreground">Deduct one session from the selected package.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="unpaid" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Bill later / unpaid</span>
                  <span className="block text-xs text-muted-foreground">Book now, then charge a card, send a payment link, record cash, or comp it from PT Session Payments.</span>
                </span>
              </label>
            </RadioGroup>
            {unpaidMode && (
              <div className="space-y-1">
                <Label className="text-xs">Session rate ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Enter session rate"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
            )}
          </div>



          {/* Trainer */}
          <div className="space-y-2">
            <Label>Trainer (optional)</Label>
            <Select value={instructorId || "any"} onValueChange={(v) => setInstructorId(v === "any" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any trainer</SelectItem>
                {instructors.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + Time + Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "60", 10))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Internal notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            A confirmation email with the <strong className="text-foreground">24-hour cancellation policy</strong> will be sent automatically.
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" /><div>{err}</div>
            </div>
          )}

          {conflict && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <div>{conflict}</div>
                <Button size="sm" variant="outline" disabled={submitting} onClick={() => submit(true)}>
                  Book anyway
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submit(false)} disabled={submitting || !userId || (!unpaidMode && !selectedPass)}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {unpaidMode ? "Book & Bill Later" : "Book & Deduct"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
