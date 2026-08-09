import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Minus, Plus, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { CREDIT_TYPE_LABELS, CreditType } from "@/lib/memberCredits";
import { isKioskMode } from "@/lib/kiosk";


interface MemberCreditRow {
  id: string;
  member_id: string;
  user_id: string | null;
  credit_type: string;
  credits_total: number;
  credits_remaining: number;
  cycle_start: string;
  cycle_end: string;
  expires_at: string;
}

interface Props {
  memberId: string;
  userId: string | null;
  memberName: string;
}

export function MemberCreditsPanel({ memberId, userId, memberName }: Props) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [adjustTarget, setAdjustTarget] = useState<MemberCreditRow | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove">("remove");
  const [adjustAmount, setAdjustAmount] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [bookDialogOpen, setBookDialogOpen] = useState(false);

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ["member-credits-panel", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_credits")
        .select("*")
        .eq("member_id", memberId)
        .gt("expires_at", new Date().toISOString())
        .order("credit_type", { ascending: true });
      if (error) throw error;
      return (data || []) as MemberCreditRow[];
    },
  });

  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["member-credit-history", memberId],
    queryFn: async () => {
      const { data: adjustments, error } = await supabase
        .from("credit_adjustments")
        .select("id, credit_type, adjustment_type, amount, previous_balance, new_balance, reason, adjusted_by, created_at")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const staffIds = [...new Set((adjustments || []).map((a) => a.adjusted_by).filter(Boolean))] as string[];
      let staffMap: Record<string, string> = {};
      if (staffIds.length) {
        const { data: staff } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", staffIds);
        staffMap = Object.fromEntries(
          (staff || []).map((s: any) => [
            s.id,
            [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || s.email || "Staff",
          ])
        );
      }
      return (adjustments || []).map((a: any) => ({
        ...a,
        staff_name: a.adjusted_by ? staffMap[a.adjusted_by] || "Staff" : "System",
      }));
    },
  });

  const [showAllHistory, setShowAllHistory] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["member-credits-panel", memberId] });
    queryClient.invalidateQueries({ queryKey: ["member-credit-history", memberId] });
    queryClient.invalidateQueries({ queryKey: ["admin-members-with-credits"] });
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    queryClient.invalidateQueries({ queryKey: ["user-credits"] });
  };

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustTarget) throw new Error("No target");
      const amt = Math.max(1, parseInt(adjustAmount, 10) || 0);
      const delta = adjustMode === "add" ? amt : -amt;
      const prev = adjustTarget.credits_remaining;
      const next = Math.max(0, Math.min(adjustTarget.credits_total, prev + delta));
      if (next === prev) throw new Error("No change");

      // Always route through the SECURITY DEFINER RPC so front desk staff
      // (who cannot write to member_credits directly) can adjust credits.
      const { data, error } = await (supabase.rpc as any)("kiosk_adjust_member_credits", {
        p_credit_id: adjustTarget.id,
        p_delta: delta,
        p_reason:
          adjustReason ||
          (adjustMode === "remove" ? "Session used (front desk)" : "Manual adjustment (front desk)"),
      });
      if (error) throw error;
      const result = (data || {}) as { previous?: number; new?: number };
      return { prev: result.previous ?? prev, next: result.new ?? next };
    },

    onSuccess: ({ prev, next }) => {
      toast.success(
        `${adjustMode === "remove" ? "Removed" : "Added"} ${Math.abs(next - prev)} ${
          CREDIT_TYPE_LABELS[adjustTarget!.credit_type as CreditType] || adjustTarget!.credit_type
        } credit${Math.abs(next - prev) === 1 ? "" : "s"}`
      );
      invalidate();
      setAdjustTarget(null);
      setAdjustReason("");
      setAdjustAmount("1");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to adjust credit"),
  });

  const openAdjust = (row: MemberCreditRow, mode: "add" | "remove") => {
    setAdjustTarget(row);
    setAdjustMode(mode);
    setAdjustAmount("1");
    setAdjustReason("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">Credits</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adjust balances or book a session on {memberName}'s behalf.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setBookDialogOpen(true)}
            disabled={!credits.some((c) => c.credits_remaining > 0)}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Book on behalf
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : credits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No active credits.
            </p>
          ) : (
            credits.map((c) => {
              const label = CREDIT_TYPE_LABELS[c.credit_type as CreditType] || c.credit_type;
              const low = c.credits_remaining === 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{label}</span>
                      <Badge variant={low ? "outline" : "secondary"}>
                        {c.credits_remaining} / {c.credits_total}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      Expires {format(parseISO(c.expires_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAdjust(c, "remove")}
                      disabled={c.credits_remaining <= 0}
                      title="Mark one used"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAdjust(c, "add")}
                      disabled={c.credits_remaining >= c.credits_total}
                      title="Add credit back"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent credit activity</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every add/remove is logged with the staff member who made the change.
          </p>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No credit activity yet.
            </p>
          ) : (
            <div className="space-y-2">
              {(showAllHistory ? history : history.slice(0, 8)).map((h: any) => {
                const isAdd = h.adjustment_type === "add";
                const label = CREDIT_TYPE_LABELS[h.credit_type as CreditType] || h.credit_type;
                const created = new Date(h.created_at);
                return (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-3 p-2.5 border rounded-md text-sm"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Badge
                        variant="outline"
                        className={
                          isAdd
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0"
                            : "border-red-300 text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 shrink-0"
                        }
                      >
                        {isAdd ? "+" : "−"}{h.amount}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {h.previous_balance} → {h.new_balance}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {h.staff_name} · <span title={format(created, "PPpp")}>{formatDistanceToNow(created, { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {history.length > 8 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAllHistory((v) => !v)}
                >
                  {showAllHistory ? "Show less" : `Show all (${history.length})`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Adjust dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustMode === "remove" ? "Remove" : "Add"}{" "}
              {adjustTarget ? CREDIT_TYPE_LABELS[adjustTarget.credit_type as CreditType] || adjustTarget.credit_type : ""} credit
            </DialogTitle>
            <DialogDescription>
              {adjustMode === "remove"
                ? `Mark one or more sessions as used for ${memberName}.`
                : `Return credits to ${memberName}'s balance.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="adj-amount">Amount</Label>
              <Input
                id="adj-amount"
                type="number"
                min={1}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adj-reason">Reason (optional)</Label>
              <Textarea
                id="adj-reason"
                placeholder={
                  adjustMode === "remove"
                    ? "e.g. Used Red Light session at 2pm"
                    : "e.g. Session was refunded"
                }
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending}>
              {adjustMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookOnBehalfDialog
        open={bookDialogOpen}
        onOpenChange={setBookDialogOpen}
        memberId={memberId}
        userId={userId}
        memberName={memberName}
        credits={credits}
        onDone={invalidate}
      />
    </div>
  );
}

// -------- Book on behalf --------

interface UpcomingSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  spots_remaining: number;
  class_type: { name: string; is_heated: boolean } | null;
  instructor: { first_name: string; last_name: string } | null;
}

function BookOnBehalfDialog({
  open,
  onOpenChange,
  memberId,
  userId,
  memberName,
  credits,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  memberId: string;
  userId: string | null;
  memberName: string;
  credits: MemberCreditRow[];
  onDone: () => void;
}) {
  const { user: authUser } = useAuth();
  const availableTypes = credits.filter((c) => c.credits_remaining > 0).map((c) => c.credit_type);
  const defaultType =
    (availableTypes.find((t) => t === "class") as CreditType | undefined) ||
    (availableTypes[0] as CreditType | undefined) ||
    "class";
  const [creditType, setCreditType] = useState<CreditType>(defaultType);
  const [sessionId, setSessionId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["book-on-behalf-sessions"],
    enabled: open && creditType === "class",
    queryFn: async (): Promise<UpcomingSession[]> => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("class_sessions")
        .select(
          `id, session_date, start_time, end_time, room, spots_remaining, is_cancelled,
           class_type:class_types!inner(name, is_heated),
           instructor:instructors(first_name, last_name)`
        )
        .gte("session_date", today)
        .eq("is_cancelled", false)
        .gt("spots_remaining", 0)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(60);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const target = credits.find((c) => c.credit_type === creditType && c.credits_remaining > 0);
      if (!target) throw new Error("No available credit of this type");

      if (creditType === "class") {
        if (!sessionId) throw new Error("Pick a class session");
        if (!userId) throw new Error("Member has no user account linked; cannot book on their behalf.");
        const { data, error } = await (supabase.rpc as any)("create_atomic_class_booking", {
          _session_id: sessionId,
          _user_id: userId,
          _payment_method: "credits",
          _member_credit_id: target.id,
          _pass_id: null,
          _amount_paid: 0,
        });
        if (error) throw error;
        if (data && (data as any).success === false) throw new Error((data as any).error || "Booking failed");
        return { kind: "class" as const };
      }

      // red_light / dry_cryo: deduct + audit via SECURITY DEFINER RPC (front desk safe)
      const reason = `Front desk booked ${CREDIT_TYPE_LABELS[creditType]} session${notes ? ` — ${notes}` : ""}`;
      const { error } = await (supabase.rpc as any)("kiosk_adjust_member_credits", {
        p_credit_id: target.id,
        p_delta: -1,
        p_reason: reason,
      });
      if (error) throw error;
      return { kind: creditType };
    },

    onSuccess: () => {
      toast.success(`Booked ${CREDIT_TYPE_LABELS[creditType]} for ${memberName}`);
      onDone();
      onOpenChange(false);
      setSessionId("");
      setNotes("");
    },
    onError: (err: any) => toast.error(err?.message || "Booking failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Book on behalf of {memberName}</DialogTitle>
          <DialogDescription>
            Uses one of the member's active credits. Logged in the credit history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service</Label>
            <Select value={creditType} onValueChange={(v) => setCreditType(v as CreditType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.includes("class") && (
                  <SelectItem value="class">Class credit (drop-in class)</SelectItem>
                )}
                {availableTypes.includes("red_light") && (
                  <SelectItem value="red_light">Red Light session</SelectItem>
                )}
                {availableTypes.includes("dry_cryo") && (
                  <SelectItem value="dry_cryo">Cryotherapy session</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {creditType === "class" ? (
            <div>
              <Label>Upcoming class</Label>
              {sessionsLoading ? (
                <div className="py-6 flex justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No upcoming classes with open spots.</p>
              ) : (
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => {
                      const time = format(parseISO(`${s.session_date}T${s.start_time}`), "EEE MMM d · h:mm a");
                      const instr = s.instructor ? `${s.instructor.first_name} ${s.instructor.last_name[0]}.` : "TBD";
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {time} — {s.class_type?.name || "Class"} · {instr} ({s.spots_remaining} left)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {!userId && (
                <p className="text-xs text-destructive mt-1.5">
                  This member has no linked account — class credit booking requires a linked user.
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="book-notes">Notes (optional)</Label>
              <Textarea
                id="book-notes"
                placeholder="e.g. Booked for 3:30pm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                This deducts 1 credit and logs the usage. Add the appointment to the schedule separately if needed.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => bookMutation.mutate()}
            disabled={
              bookMutation.isPending ||
              (creditType === "class" && (!sessionId || !userId))
            }
          >
            {bookMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
