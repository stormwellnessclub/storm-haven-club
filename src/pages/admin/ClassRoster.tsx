import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, CheckCircle, Loader2, UserPlus, Trash2, UserCheck, X, Clock, ArrowUp, XCircle, ArrowLeft, Phone, Pencil, Check, Lock, UserCog, UserX, RotateCcw,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PersonSearch, type PersonResult } from "@/components/admin/roster/PersonSearch";
import { PaymentMethodSelector, type PaymentOption } from "@/components/admin/roster/PaymentMethodSelector";
import { SellClassPackage } from "@/components/admin/SellClassPackage";
import { resolveRosterIdentities, type RosterAttendee } from "@/hooks/useRosterIdentity";
import { useRosterClassStats } from "@/hooks/useRosterClassStats";
import { Sparkles, Trophy } from "lucide-react";

// Best-effort: resolve email/phone for a userId, then send confirmation email + SMS.
// Non-fatal: errors are logged and swallowed so the booking flow isn't blocked.
async function sendClassConfirmationNotifications(args: {
  userId: string | null;
  fallbackEmail?: string | null;
  fallbackPhone?: string | null;
  fallbackName?: string | null;
  emailType: "booking_confirmation" | "waitlist_claim_confirmation";
  smsTemplateKey: "class-booking-confirmation" | "waitlist-promoted";
  className: string;
  dateLabel: string;
  timeLabel: string;
  instructor?: string;
  bookingId: string;
  source: string;
}) {
  try {
    let email = args.fallbackEmail ?? null;
    let phone = args.fallbackPhone ?? null;
    let smsOptIn = false;
    let firstName = args.fallbackName ?? "";

    if (args.userId) {
      const [{ data: member }, { data: prof }, { data: nonMember }] = await Promise.all([
        supabase.from("members").select("email, phone, first_name").eq("user_id", args.userId).maybeSingle(),
        supabase.from("profiles").select("email, phone, sms_opt_in, first_name").eq("user_id", args.userId).maybeSingle(),
        supabase.from("non_member_profiles").select("email, phone, sms_opt_in, first_name").eq("user_id", args.userId).maybeSingle(),
      ]);
      email = email || (member as any)?.email || (prof as any)?.email || (nonMember as any)?.email || null;
      phone = phone || (member as any)?.phone || (prof as any)?.phone || (nonMember as any)?.phone || null;
      smsOptIn = (prof as any)?.sms_opt_in === true || (nonMember as any)?.sms_opt_in === true;
      firstName = firstName || (member as any)?.first_name || (prof as any)?.first_name || (nonMember as any)?.first_name || "";
    }

    const emailData =
      args.emailType === "waitlist_claim_confirmation"
        ? {
            class_name: args.className,
            date: args.dateLabel,
            time: args.timeLabel,
            instructor: args.instructor || "TBA",
            first_name: firstName,
          }
        : {
            className: args.className,
            date: args.dateLabel,
            time: args.timeLabel,
            instructor: args.instructor || "TBA",
            first_name: firstName,
          };

    await Promise.allSettled([
      email
        ? supabase.functions.invoke("send-email", {
            body: { type: args.emailType, to: email, data: emailData },
          })
        : Promise.resolve(),
      phone && smsOptIn
        ? supabase.functions.invoke("send-sms", {
            body: {
              to: { phone, userId: args.userId },
              templateKey: args.smsTemplateKey,
              variables: { className: args.className, date: args.dateLabel, time: args.timeLabel },
              idempotencyKey: `${args.source}-${args.bookingId}`,
              metadata: { source: args.source, booking_id: args.bookingId },
            },
          })
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.warn("sendClassConfirmationNotifications failed (non-fatal):", e);
  }
}

export default function ClassRoster() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add panel state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addTab, setAddTab] = useState<"search" | "walkin">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [walkInFirst, setWalkInFirst] = useState("");
  const [walkInLast, setWalkInLast] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentOption | null>(null);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [dropInRate, setDropInRate] = useState<"member" | "nonmember">("nonmember");
  const [showSellPackage, setShowSellPackage] = useState(false);
  const [resolvedWalkIn, setResolvedWalkIn] = useState<{ userId: string | null; memberId: string | null } | null>(null);
  const [rosterTab, setRosterTab] = useState<"roster" | "waitlist">("roster");
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityValue, setCapacityValue] = useState<number>(0);

  // Hold-slot dialog
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdCount, setHoldCount] = useState<number>(1);
  const [holdNote, setHoldNote] = useState<string>("");

  // Convert-hold dialog
  const [convertEntry, setConvertEntry] = useState<{ bookingId: string; defaultName: string } | null>(null);
  const [convertFirst, setConvertFirst] = useState("");
  const [convertLast, setConvertLast] = useState("");
  const [convertPhone, setConvertPhone] = useState("");
  const [convertEmail, setConvertEmail] = useState("");

  // Promote-from-waitlist dialog state
  const [promoteEntry, setPromoteEntry] = useState<{ id: string; user_id: string; memberId: string | null; name: string } | null>(null);
  const [promoteMethod, setPromoteMethod] = useState<PaymentOption | null>(null);
  const [promotePassId, setPromotePassId] = useState<string | null>(null);
  const [promoteCreditId, setPromoteCreditId] = useState<string | null>(null);
  const [promoteDropInRate, setPromoteDropInRate] = useState<"member" | "nonmember">("member");

  // Resolve walk-in email
  useEffect(() => {
    if (!walkInEmail.trim() || walkInEmail.length < 5) {
      setResolvedWalkIn(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("email", walkInEmail.trim())
        .maybeSingle();
      if (profile) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("status", "active")
          .maybeSingle();
        setResolvedWalkIn({ userId: profile.user_id, memberId: member?.id || null });
      } else {
        setResolvedWalkIn(null);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [walkInEmail]);

  const resetForm = () => {
    setSearchQuery("");
    setSelectedPerson(null);
    setShowAddPanel(false);
    setAddTab("search");
    setWalkInFirst("");
    setWalkInLast("");
    setWalkInEmail("");
    setWalkInPhone("");
    setPaymentMethod(null);
    setSelectedPassId(null);
    setSelectedCreditId(null);
    setDropInRate("nonmember");
    setResolvedWalkIn(null);
  };

  const effectiveUserId = addTab === "search" ? selectedPerson?.userId : resolvedWalkIn?.userId;
  const effectiveMemberId = addTab === "search" ? selectedPerson?.memberId : resolvedWalkIn?.memberId;
  const effectiveIsMember = addTab === "search" ? selectedPerson?.type === "member" : !!resolvedWalkIn?.memberId;

  const showPaymentStep = addTab === "search"
    ? !!selectedPerson
    : !!(walkInFirst.trim() && walkInLast.trim());

  // Fetch session details
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["class-roster-session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, class_type_id, session_date, start_time, end_time, max_capacity, current_enrollment, is_cancelled, is_hidden, is_invite_only, is_fundraiser, override_price_cents, fundraiser_beneficiary, class_types!inner(name)")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  const className = session ? (Array.isArray(session.class_types) ? session.class_types[0]?.name : (session.class_types as any)?.name) : "";
  const sessionDate = session?.session_date ? new Date(session.session_date + "T00:00:00") : new Date();
  const isFundraiserSession = !!(session as any)?.is_fundraiser;
  const fundraiserAmountCents = (session as any)?.override_price_cents ?? 4000;
  const fundraiserBeneficiary = (session as any)?.fundraiser_beneficiary || "";

  // Fetch bookings using shared resolver
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["class-roster-bookings", sessionId],
    queryFn: async () => {
      const attendees = await resolveRosterIdentities(sessionId!);

      // Auto-heal enrollment counter (exclude no-show rows so the seat is freed)
      const confirmedCount = attendees.filter(a => !a.isNoShow).length;
      if (session && confirmedCount !== session.current_enrollment) {
        await supabase
          .from("class_sessions")
          .update({ current_enrollment: confirmedCount })
          .eq("id", sessionId!);
      }

      return attendees;
    },
    enabled: !!sessionId && !!session,
  });

  // Per-attendee class stats (first-in-type, total classes, milestones) — shared with kiosk
  const { data: rosterStats } = useRosterClassStats(sessionId);


  // Fetch waitlist
  const { data: waitlist = [], isLoading: waitlistLoading } = useQuery({
    queryKey: ["class-roster-waitlist", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_waitlist")
        .select("id, user_id, position, status, notified_at, claimed_at, claim_expires_at, created_at, payment_method, pass_id, member_credit_id, hold_refunded")
        .eq("session_id", sessionId!)
        .in("status", ["waiting", "notified"])
        .order("position", { ascending: true });
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = data.map(w => w.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      return data.map(w => ({ ...w, profile: profileMap.get(w.user_id) || null }));
    },
    enabled: !!sessionId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["class-roster-bookings", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["class-roster-session", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["class-roster-waitlist", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["soft-launch-booking-counts"] });
  };

  // Update capacity mutation
  const updateCapacityMutation = useMutation({
    mutationFn: async (newCapacity: number) => {
      const { error } = await supabase
        .from("class_sessions")
        .update({ max_capacity: newCapacity })
        .eq("id", sessionId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Capacity updated");
      invalidateAll();
      setEditingCapacity(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update capacity"),
  });

  // Hold slots mutation — insert N placeholder bookings
  const holdSlotsMutation = useMutation({
    mutationFn: async ({ count, note }: { count: number; note: string }) => {
      if (!session) throw new Error("Session not loaded");
      const remaining = session.max_capacity - bookings.length;
      if (count < 1) throw new Error("Hold at least 1 seat");
      if (count > remaining) throw new Error(`Only ${remaining} seat${remaining === 1 ? "" : "s"} remain`);
      const baseLabel = note.trim() || "HOLD — Pending";
      const rows = Array.from({ length: count }, (_, i) => ({
        session_id: sessionId!,
        status: "confirmed" as const,
        payment_method: "comp",
        is_admin_hold: true,
        walk_in_name: count > 1 ? `${baseLabel} #${i + 1}` : baseLabel,
        amount_paid: 0,
        booked_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("class_bookings").insert(rows as any);
      if (error) throw error;
      await supabase
        .from("class_sessions")
        .update({ current_enrollment: bookings.length + count })
        .eq("id", sessionId!);
    },
    onSuccess: (_d, vars) => {
      invalidateAll();
      setHoldDialogOpen(false);
      setHoldCount(1);
      setHoldNote("");
      toast.success(`Held ${vars.count} seat${vars.count === 1 ? "" : "s"}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to hold seats"),
  });

  // Release a held seat (delete row + decrement)
  const releaseHoldMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("class_bookings").delete().eq("id", bookingId);
      if (error) throw error;
      const { count } = await supabase
        .from("class_bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId!)
        .in("status", ["confirmed", "completed"]);
      if (typeof count === "number") {
        await supabase.from("class_sessions").update({ current_enrollment: count }).eq("id", sessionId!);
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Seat released"); },
    onError: (err: any) => toast.error(err.message || "Failed to release"),
  });

  // Convert a held seat into a real attendee
  const convertHoldMutation = useMutation({
    mutationFn: async (args: { bookingId: string; first: string; last: string; phone: string; email: string }) => {
      const { bookingId, first, last, phone, email } = args;
      if (!first.trim() || !last.trim() || !phone.trim()) {
        throw new Error("First name, last name, and phone are required");
      }
      // Try to link to an existing account by email
      let userId: string | null = null;
      let memberId: string | null = null;
      if (email.trim()) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("email", email.trim())
          .maybeSingle();
        if (profile) {
          userId = profile.user_id;
          const { data: member } = await supabase
            .from("members")
            .select("id")
            .eq("user_id", profile.user_id)
            .eq("status", "active")
            .maybeSingle();
          memberId = member?.id || null;
        }
      }
      const { error } = await supabase
        .from("class_bookings")
        .update({
          is_admin_hold: false,
          walk_in_name: `${first.trim()} ${last.trim()}`,
          walk_in_phone: phone.trim(),
          walk_in_email: email.trim() || null,
          user_id: userId,
          member_id: memberId,
        } as any)
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setConvertEntry(null);
      setConvertFirst(""); setConvertLast(""); setConvertPhone(""); setConvertEmail("");
      toast.success("Hold converted to attendee");
    },
    onError: (err: any) => toast.error(err.message || "Failed to convert"),
  });

  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "completed" as const, checked_in_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Member checked in"); },
    onError: () => toast.error("Failed to check in"),
  });

  // Remove booking mutation with credit/pass refund + cancellation email
  const removeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      // Pull everything we need for the email BEFORE we cancel.
      const { data: booking, error: fetchErr } = await supabase
        .from("class_bookings")
        .select("id, payment_method, pass_id, member_credit_id, credits_used, walk_in_email, walk_in_name, member_id, user_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (fetchErr) {
        console.error("Booking fetch error:", fetchErr);
        throw new Error(fetchErr.message || "Failed to load booking");
      }
      if (!booking) throw new Error("Booking not found");

      // Fetch member + profile separately (embedded joins fail because user_id FK points to auth.users, not profiles).
      let member: { first_name?: string; last_name?: string; email?: string } | null = null;
      let profile: { first_name?: string; last_name?: string; email?: string } | null = null;
      if (booking.member_id) {
        const { data } = await supabase
          .from("members")
          .select("first_name, last_name, email")
          .eq("id", booking.member_id)
          .maybeSingle();
        member = data as any;
      }
      if (booking.user_id) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", booking.user_id)
          .maybeSingle();
        profile = data as any;
      }

      if (booking.payment_method === "credits" && booking.member_credit_id) {
        const { data: credit } = await supabase
          .from("member_credits")
          .select("credits_remaining")
          .eq("id", booking.member_credit_id)
          .single();
        if (credit) {
          await supabase
            .from("member_credits")
            .update({ credits_remaining: credit.credits_remaining + (booking.credits_used || 1) })
            .eq("id", booking.member_credit_id);
        }
      }

      if (booking.payment_method === "pass" && booking.pass_id) {
        const { data: pass } = await supabase
          .from("class_passes")
          .select("classes_remaining, status")
          .eq("id", booking.pass_id)
          .single();
        if (pass) {
          await supabase
            .from("class_passes")
            .update({ classes_remaining: pass.classes_remaining + 1, status: "active" as any })
            .eq("id", booking.pass_id);
        }
      }

      const { error } = await supabase
        .from("class_bookings")
        .update({
          status: "cancelled" as const,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Removed by admin",
        })
        .eq("id", bookingId);
      if (error) throw error;

      // If this booking came from the waitlist, fully close any related claimed/waiting
      // waitlist row so the person is completely removed from the class.
      if (booking.user_id) {
        try {
          await supabase
            .from("class_waitlist")
            .update({ status: "expired" as any, hold_refunded: true })
            .eq("session_id", sessionId!)
            .eq("user_id", booking.user_id)
            .in("status", ["claimed", "waiting", "notified"] as any);
        } catch (err) {
          console.error("Failed to close waitlist entry:", err);
        }
      }

      // Recompute enrollment counter to keep the roster header accurate.
      try {
        const { count } = await supabase
          .from("class_bookings")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId!)
          .in("status", ["confirmed", "completed"]);
        if (typeof count === "number") {
          await supabase
            .from("class_sessions")
            .update({ current_enrollment: count })
            .eq("id", sessionId!);
        }
      } catch (err) {
        console.error("Failed to recompute enrollment:", err);
      }

      // Send cancellation email (best-effort — don't block on failure).
      // Resolve recipient: member > linked profile > walk-in fallback.
      try {
        // member and profile already fetched above
        const email = member?.email || profile?.email || booking.walk_in_email;
        const firstName = member?.first_name || profile?.first_name || booking.walk_in_name?.split(" ")[0];
        const lastName = member?.last_name || profile?.last_name;
        const name = [firstName, lastName].filter(Boolean).join(" ") || booking.walk_in_name || "Guest";

        if (email && session) {
          const formattedDate = format(sessionDate, "MMMM d, yyyy");
          const [h, m] = (session.start_time || "00:00:00").split(":").map(Number);
          const timeDate = new Date();
          timeDate.setHours(h, m, 0, 0);
          const formattedTime = format(timeDate, "h:mm a");

          supabase.functions.invoke("send-email", {
            body: {
              type: "class_cancelled_by_admin",
              to: email,
              data: {
                name,
                className: className || "Class",
                date: formattedDate,
                time: formattedTime,
              },
            },
          }).catch((err) => console.error("Failed to send removal email:", err));
        }
      } catch (err) {
        console.error("Failed to prepare removal email:", err);
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Attendee removed — credit/pass restored, member notified"); },
    onError: (err: any) => toast.error(err?.message || "Failed to remove"),
  });

  // Undo a no-show: restore booking(s) back to confirmed. No credit/pass change.
  const undoNoShowMutation = useMutation({
    mutationFn: async (bookingIds: string[]) => {
      if (bookingIds.length === 0) return 0;
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "confirmed", updated_at: new Date().toISOString() } as any)
        .in("id", bookingIds);
      if (error) throw error;
      return bookingIds.length;
    },
    onSuccess: (count) => {
      invalidateAll();
      toast.success(count === 1 ? "Restored — back to Registered" : `${count} attendees restored to Registered`);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to undo no-show"),
  });

  // Mark single attendee as no-show. Credit/pass stays consumed; no email sent.
  const noShowMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "no_show", updated_at: new Date().toISOString() } as any)
        .eq("id", bookingId);
      if (error) throw error;
      return bookingId;
    },
    onSuccess: (bookingId) => {
      invalidateAll();
      toast.success("Marked as no-show — credit/pass kept", {
        action: { label: "Undo", onClick: () => undoNoShowMutation.mutate([bookingId]) },
      });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to mark no-show"),
  });

  // Bulk: mark all remaining confirmed (not-checked-in) attendees as no-show.
  const bulkNoShowMutation = useMutation({
    mutationFn: async (bookingIds: string[]) => {
      if (bookingIds.length === 0) return { count: 0, ids: [] as string[] };
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "no_show", updated_at: new Date().toISOString() } as any)
        .in("id", bookingIds);
      if (error) throw error;
      return { count: bookingIds.length, ids: bookingIds };
    },
    onSuccess: ({ count, ids }) => {
      invalidateAll();
      toast.success(`${count} attendee${count === 1 ? "" : "s"} marked as no-show`, {
        action: { label: "Undo", onClick: () => undoNoShowMutation.mutate(ids) },
      });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to mark no-shows"),
  });


  // Promote from waitlist (with payment method choice)
  const promoteMutation = useMutation({
    mutationFn: async (args: {
      waitlistId: string;
      userId: string;
      memberId: string | null;
      method: PaymentOption;
      passId: string | null;
      creditId: string | null;
      dropInRate: "member" | "nonmember";
    }) => {
      const { waitlistId, userId, memberId, method, passId, creditId, dropInRate } = args;

      // Refund any waitlist hold first so the regular decrement below doesn't double-charge.
      try {
        await supabase.rpc("refund_waitlist_hold", { p_waitlist_id: waitlistId });
      } catch (e) {
        console.error("refund_waitlist_hold failed (continuing):", e);
      }

      // Block double-bookings
      const { data: existing } = await supabase
        .from("class_bookings")
        .select("id")
        .eq("session_id", sessionId!)
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .maybeSingle();
      if (existing) throw new Error("This person is already booked");

      if (method === "pass") {
        if (!passId) throw new Error("Select a class pass");
        const { data: pass, error: passErr } = await supabase
          .from("class_passes")
          .select("classes_remaining")
          .eq("id", passId)
          .single();
        if (passErr || !pass || pass.classes_remaining <= 0) throw new Error("Pass has no remaining classes");

        await supabase
          .from("class_passes")
          .update({
            classes_remaining: pass.classes_remaining - 1,
            status: pass.classes_remaining - 1 <= 0 ? ("exhausted" as any) : ("active" as any),
          })
          .eq("id", passId);

        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "pass", pass_id: passId,
          booked_at: new Date().toISOString(),
        });
      } else if (method === "credits") {
        let targetCreditId = creditId;
        if (!targetCreditId && memberId) {
          const { data: creds } = await supabase
            .from("member_credits")
            .select("id, credits_remaining")
            .eq("member_id", memberId)
            .eq("credit_type", "class")
            .gt("credits_remaining", 0)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: true })
            .limit(1);
          if (!creds?.length) throw new Error("No class credits available");
          targetCreditId = creds[0].id;
        }
        if (!targetCreditId) throw new Error("No credits available");

        const { data: credit, error: credErr } = await supabase
          .from("member_credits")
          .select("credits_remaining")
          .eq("id", targetCreditId)
          .single();
        if (credErr || !credit || credit.credits_remaining <= 0) throw new Error("No credits remaining");

        await supabase
          .from("member_credits")
          .update({ credits_remaining: credit.credits_remaining - 1 })
          .eq("id", targetCreditId);

        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "credits",
          member_credit_id: targetCreditId, credits_used: 1,
          booked_at: new Date().toISOString(),
        });
      } else if (method === "dropin") {
        const amountCents = isFundraiserSession
          ? fundraiserAmountCents
          : (dropInRate === "member" ? 2500 : 3000);
        const chargeDescription = isFundraiserSession
          ? `Donation: ${className} on ${session?.session_date}${fundraiserBeneficiary ? ` — ${fundraiserBeneficiary}` : ""} (waitlist promotion)`
          : `Drop-in: ${className} on ${session?.session_date} (waitlist promotion)`;

        // Charge the saved card BEFORE creating the booking. Uses admin_charge_user_saved_card
        // which looks across members, non_member_profiles, profiles, and Stripe by email —
        // matching exactly what the Non-Member Account page treats as "card on file".
        if (!userId) {
          throw new Error("No account linked to this waitlist entry — cannot charge a saved card.");
        }
        let chargeData: any = null;
        let chargeErr: any = null;
        try {
          const res = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "admin_charge_user_saved_card",
              userId,
              amount: amountCents,
              description: chargeDescription,
              grossUpFee: true,
              metadata: {
                source: "waitlist_promotion",
                session_id: sessionId,
                waitlist_id: waitlistId,
                class_name: className,
              },
            },
          });
          chargeData = res.data;
          chargeErr = res.error;
        } catch (e: any) {
          chargeErr = e;
        }
        if (chargeErr || !chargeData?.success) {
          const reason = chargeData?.error || chargeErr?.message || "Card declined";
          const hint = /no payment method/i.test(reason)
            ? " Tip: the Non-Member page may show old card metadata even if the card was removed from the payment provider. Re-add the card to charge."
            : "";
          throw new Error(`Card declined — $${(amountCents / 100).toFixed(2)} NOT collected: ${reason}.${hint}`);
        }

        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed",
          payment_method: isFundraiserSession ? "fundraiser" : "walk_in",
          amount_paid: amountCents,
          booked_at: new Date().toISOString(),
        });
      } else if (method === "comp") {
        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "comp",
          booked_at: new Date().toISOString(),
        });
      } else {
        throw new Error("Unsupported payment method for promotion");
      }

      // Mark waitlist entry claimed only after the booking succeeds.
      await supabase
        .from("class_waitlist")
        .update({ status: "claimed" as any, claimed_at: new Date().toISOString() })
        .eq("id", waitlistId);

      // Look up the booking we just created so we can send a confirmation.
      const { data: bookingRow } = await supabase
        .from("class_bookings")
        .select("id")
        .eq("session_id", sessionId!)
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .order("booked_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Best-effort confirmation email + SMS — never blocks the promotion.
      const dateLabel = session?.session_date
        ? new Date(session.session_date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago",
          })
        : "";
      const timeLabel = session?.start_time
        ? new Date(`2000-01-01T${String(session.start_time).slice(0, 5)}:00`).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit",
          })
        : "";
      await sendClassConfirmationNotifications({
        userId,
        emailType: "waitlist_claim_confirmation",
        smsTemplateKey: "waitlist-promoted",
        className: className || "your class",
        dateLabel,
        timeLabel,
        bookingId: bookingRow?.id || waitlistId,
        source: "waitlist_promote",
      });

      return { method, amountCents: method === "dropin" ? (isFundraiserSession ? fundraiserAmountCents : (dropInRate === "member" ? 2500 : 3000)) : 0 };
    },
    onSuccess: (result) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["roster-passes"] });
      queryClient.invalidateQueries({ queryKey: ["roster-credits"] });
      setPromoteEntry(null);
      setPromoteMethod(null);
      setPromotePassId(null);
      setPromoteCreditId(null);
      if (result?.method === "dropin" && result.amountCents > 0) {
        toast.success(`Charged $${(result.amountCents / 100).toFixed(2)} and promoted from waitlist`);
      } else {
        toast.success("Promoted from waitlist");
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to promote"),
  });

  // Remove from waitlist (refund the held credit/pass)
  const removeWaitlistMutation = useMutation({
    mutationFn: async (waitlistId: string) => {
      try {
        await supabase.rpc("refund_waitlist_hold", { p_waitlist_id: waitlistId });
      } catch (e) {
        console.error("refund_waitlist_hold failed (continuing):", e);
      }
      await supabase
        .from("class_waitlist")
        .update({ status: "expired" as any })
        .eq("id", waitlistId);
    },
    onSuccess: () => { invalidateAll(); toast.success("Removed from waitlist — credit/pass refunded"); },
    onError: () => toast.error("Failed to remove from waitlist"),
  });

  // Add to class mutation
  const addToClassMutation = useMutation({
    mutationFn: async () => {
      if (!paymentMethod) throw new Error("Select a payment method");
      const userId = effectiveUserId || null;
      const memberId = effectiveMemberId || null;
      const walkInName = addTab === "walkin" ? `${walkInFirst.trim()} ${walkInLast.trim()}` : null;
      const walkInEmailVal = addTab === "walkin" && walkInEmail.trim() ? walkInEmail.trim() : null;
      const walkInPhoneVal = addTab === "walkin" && walkInPhone.trim() ? walkInPhone.trim() : null;
      let chargedAmountCents = 0;
      let collectAtDeskCents = 0;

      if (userId) {
        const { data: existing } = await supabase
          .from("class_bookings")
          .select("id")
          .eq("session_id", sessionId!)
          .eq("user_id", userId)
          .eq("status", "confirmed")
          .maybeSingle();
        if (existing) throw new Error("This person is already booked");
      }

      if (paymentMethod === "pass") {
        if (!selectedPassId) throw new Error("Select a class pass");
        const { data: pass, error: passErr } = await supabase
          .from("class_passes")
          .select("classes_remaining")
          .eq("id", selectedPassId)
          .single();
        if (passErr || !pass || pass.classes_remaining <= 0) throw new Error("Pass has no remaining classes");

        await supabase
          .from("class_passes")
          .update({
            classes_remaining: pass.classes_remaining - 1,
            status: pass.classes_remaining - 1 <= 0 ? "exhausted" as any : "active" as any,
          })
          .eq("id", selectedPassId);

        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "pass", pass_id: selectedPassId,
          walk_in_name: walkInName, walk_in_email: walkInEmailVal, walk_in_phone: walkInPhoneVal,
          booked_at: new Date().toISOString(),
        });
      } else if (paymentMethod === "credits") {
        let targetCreditId = selectedCreditId;
        if (!targetCreditId && memberId) {
          const { data: creds } = await supabase
            .from("member_credits")
            .select("id, credits_remaining")
            .eq("member_id", memberId)
            .eq("credit_type", "class")
            .gt("credits_remaining", 0)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: true })
            .limit(1);
          if (!creds?.length) throw new Error("No class credits available");
          targetCreditId = creds[0].id;
        }
        if (!targetCreditId) throw new Error("No credits available");

        const { data: credit, error: credErr } = await supabase
          .from("member_credits")
          .select("credits_remaining")
          .eq("id", targetCreditId)
          .single();
        if (credErr || !credit || credit.credits_remaining <= 0) throw new Error("No credits remaining");

        await supabase
          .from("member_credits")
          .update({ credits_remaining: credit.credits_remaining - 1 })
          .eq("id", targetCreditId);

        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "credits", member_credit_id: targetCreditId,
          credits_used: 1, walk_in_name: walkInName, walk_in_email: walkInEmailVal, walk_in_phone: walkInPhoneVal,
          booked_at: new Date().toISOString(),
        });
      } else if (paymentMethod === "dropin") {
        const amountCents = isFundraiserSession
          ? fundraiserAmountCents
          : (dropInRate === "member" ? 2500 : 3000);
        const chargeDescription = isFundraiserSession
          ? `Donation: ${className} on ${session?.session_date}${fundraiserBeneficiary ? ` — ${fundraiserBeneficiary}` : ""}`
          : `Drop-in: ${className} on ${session?.session_date}`;

        // Resolve a chargeable target via the admin saved-card lookup (members + non-members + Stripe-by-email).
        let chargeData: any = null;
        let chargeErr: any = null;
        let chargeAttempted = false;
        if (userId) {
          chargeAttempted = true;
          try {
            const res = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "admin_charge_user_saved_card",
                userId,
                amount: amountCents,
                description: chargeDescription,
                grossUpFee: true,
                metadata: {
                  source: "add_to_class",
                  session_id: sessionId,
                  class_name: className,
                },
              },
            });
            chargeData = res.data;
            chargeErr = res.error;
          } catch (e: any) {
            chargeErr = e;
          }
        }
        if (chargeAttempted && chargeData?.success) {
          // Charge succeeded — create the booking.
          await supabase.from("class_bookings").insert({
            session_id: sessionId!, user_id: userId, member_id: memberId,
            status: "confirmed",
            payment_method: isFundraiserSession ? "fundraiser" : "walk_in",
            amount_paid: amountCents,
            walk_in_name: walkInName, walk_in_email: walkInEmailVal, walk_in_phone: walkInPhoneVal,
            booked_at: new Date().toISOString(),
          });
          chargedAmountCents = amountCents;
        } else if (chargeAttempted && (chargeErr || chargeData?.error)) {
          const reason = chargeData?.error || chargeErr?.message || "Card declined";
          // If we got "no payment method on file", fall back to collect-at-desk silently.
          if (/no payment method/i.test(reason)) {
            await supabase.from("class_bookings").insert({
              session_id: sessionId!, user_id: userId, member_id: memberId,
              status: "confirmed",
              payment_method: isFundraiserSession ? "fundraiser" : "walk_in",
              amount_paid: amountCents,
              walk_in_name: walkInName, walk_in_email: walkInEmailVal, walk_in_phone: walkInPhoneVal,
              booked_at: new Date().toISOString(),
            });
            collectAtDeskCents = amountCents;
          } else {
            throw new Error(`Card declined — $${(amountCents / 100).toFixed(2)} NOT collected: ${reason}. Booking NOT created.`);
          }
        } else {
          // Walk-in with no linked account: record the booking; collect at the desk.
          await supabase.from("class_bookings").insert({
            session_id: sessionId!, user_id: userId, member_id: memberId,
            status: "confirmed",
            payment_method: isFundraiserSession ? "fundraiser" : "walk_in",
            amount_paid: amountCents,
            walk_in_name: walkInName, walk_in_email: walkInEmailVal, walk_in_phone: walkInPhoneVal,
            booked_at: new Date().toISOString(),
          });
          collectAtDeskCents = amountCents;
        }
      } else if (paymentMethod === "comp") {
        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "comp", walk_in_name: walkInName,
          walk_in_email: walkInEmailVal, walk_in_phone: walkInPhoneVal,
          booked_at: new Date().toISOString(),
        });
      }

      // Best-effort confirmation email + SMS for the newly-added attendee.
      if (userId) {
        const dateLabel = session?.session_date
          ? new Date(session.session_date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago",
            })
          : "";
        const timeLabel = session?.start_time
          ? new Date(`2000-01-01T${String(session.start_time).slice(0, 5)}:00`).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit",
            })
          : "";
        await sendClassConfirmationNotifications({
          userId,
          fallbackEmail: walkInEmailVal,
          fallbackPhone: walkInPhoneVal,
          fallbackName: walkInName,
          emailType: "booking_confirmation",
          smsTemplateKey: "class-booking-confirmation",
          className: className || "your class",
          dateLabel,
          timeLabel,
          bookingId: `${sessionId}-${userId}`,
          source: "admin_add_to_class",
        });
      }

      return { chargedAmountCents, collectAtDeskCents };
    },
    onSuccess: (result) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["roster-passes"] });
      queryClient.invalidateQueries({ queryKey: ["roster-credits"] });
      resetForm();
      if (result?.chargedAmountCents) {
        toast.success(`Charged $${(result.chargedAmountCents / 100).toFixed(2)} — added to class`);
      } else if (result?.collectAtDeskCents) {
        toast.info(`Booking added — collect $${(result.collectAtDeskCents / 100).toFixed(2)} at desk`, { duration: 5000 });
      } else {
        toast.success("Added to class");
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add"),
  });

  const canSubmit = (() => {
    if (!paymentMethod) return false;
    if (paymentMethod === "pass" && !selectedPassId) return false;
    if (paymentMethod === "sell") return false;
    if (addTab === "walkin" && (!walkInFirst.trim() || !walkInLast.trim() || !walkInPhone.trim())) return false;
    if (addTab === "search" && !selectedPerson) return false;
    return true;
  })();

  const paymentLabel = (method: string | null) => {
    switch (method) {
      case "pass": return "Pass";
      case "credits": return "Credit";
      case "comp": return "Comp";
      case "walk_in": return "Drop-in";
      case "admin_add": return "Admin";
      default: return method || "—";
    }
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/classes")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Classes
        </Button>
        <p className="text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate("/admin/classes")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Classes
          </Button>
          <h1 className="text-2xl font-bold">{className}</h1>
          <p className="text-muted-foreground">
            {format(sessionDate, "EEEE, MMMM d, yyyy")} · {formatTime(session.start_time)}
            {session.end_time ? ` – ${formatTime(session.end_time)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            {editingCapacity ? (
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold">{bookings.length}/</span>
                <Input
                  type="number"
                  min={1}
                  value={capacityValue}
                  onChange={(e) => setCapacityValue(Number(e.target.value))}
                  className="w-16 h-8 text-center text-lg font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateCapacityMutation.mutate(capacityValue);
                    if (e.key === "Escape") setEditingCapacity(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateCapacityMutation.mutate(capacityValue)} disabled={updateCapacityMutation.isPending}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCapacity(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold">{bookings.length}/{session.max_capacity}</p>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setCapacityValue(session.max_capacity); setEditingCapacity(true); }}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Enrolled</p>
          </div>
          {session.is_cancelled && <Badge variant="destructive">Cancelled</Badge>}
          {(session as any).is_invite_only && <Badge className="bg-purple-600 hover:bg-purple-700">Invite Only</Badge>}
          {(session as any).is_hidden && <Badge variant="outline">Hidden</Badge>}
        </div>
      </div>

      {/* Session flags */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Switch
            id="invite-only-session"
            checked={!!(session as any).is_invite_only}
            onCheckedChange={async (v) => {
              const { error } = await supabase.from("class_sessions").update({ is_invite_only: v } as any).eq("id", sessionId!);
              if (error) return toast.error(error.message);
              toast.success(v ? "Class is now invite only (free)" : "Invite only removed");
              invalidateAll();
            }}
          />
          <Label htmlFor="invite-only-session" className="cursor-pointer">Invite only <span className="text-muted-foreground font-normal">(free, staff-added)</span></Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="hidden-session"
            checked={!!(session as any).is_hidden}
            onCheckedChange={async (v) => {
              const { error } = await supabase.from("class_sessions").update({ is_hidden: v } as any).eq("id", sessionId!);
              if (error) return toast.error(error.message);
              toast.success(v ? "Hidden from public schedule" : "Now visible on schedule");
              invalidateAll();
            }}
          />
          <Label htmlFor="hidden-session" className="cursor-pointer">Hide from public schedule</Label>
        </div>
      </div>

      {/* Hold seats action */}
      {(() => {
        const holdCountActive = bookings.filter((a) => a.isAdminHold).length;
        const remaining = session.max_capacity - bookings.length;
        return (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Lock className="h-4 w-4" />
              {holdCountActive > 0 ? (
                <span><span className="font-semibold">{holdCountActive}</span> seat{holdCountActive === 1 ? "" : "s"} held by admin{holdCountActive >= remaining + holdCountActive ? " — class shows full to public" : ""}.</span>
              ) : (
                <span>Reserve seats so they can't be booked publicly. Convert to a real attendee later.</span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setHoldCount(Math.min(1, Math.max(1, remaining))); setHoldNote(""); setHoldDialogOpen(true); }}
              disabled={remaining <= 0 || session.is_cancelled}
            >
              <Lock className="h-4 w-4 mr-1.5" />
              Hold Slots
            </Button>
          </div>
        );
      })()}


      {/* Add to Class Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              <UserPlus className="h-4 w-4 inline mr-2" />
              Add to Class
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setShowAddPanel(!showAddPanel); if (showAddPanel) resetForm(); }}>
              {showAddPanel ? "Close" : "Open"}
            </Button>
          </div>
        </CardHeader>
        {showAddPanel && (
          <CardContent className="space-y-4">
            <Tabs value={addTab} onValueChange={(v) => { setAddTab(v as "search" | "walkin"); setSelectedPerson(null); setPaymentMethod(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Find Person</TabsTrigger>
                <TabsTrigger value="walkin">Walk-In / New</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-3 mt-2">
                {!selectedPerson ? (
                  <PersonSearch search={searchQuery} onSearchChange={setSearchQuery} onSelect={(p) => { setSelectedPerson(p); setSearchQuery(""); setDropInRate(p.type === "member" ? "member" : "nonmember"); }} />
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {selectedPerson.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{selectedPerson.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedPerson.email}</p>
                      </div>
                      <Badge variant="secondary">{selectedPerson.type === "member" ? "Member" : selectedPerson.type === "pass_holder" ? "Pass Holder" : "Account"}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedPerson(null); setPaymentMethod(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="walkin" className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name *</Label><Input value={walkInFirst} onChange={(e) => setWalkInFirst(e.target.value)} placeholder="First name" /></div>
                  <div><Label>Last Name *</Label><Input value={walkInLast} onChange={(e) => setWalkInLast(e.target.value)} placeholder="Last name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Phone *</Label>
                    <Input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="Required" type="tel" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={walkInEmail} onChange={(e) => setWalkInEmail(e.target.value)} placeholder="Optional — links passes" type="email" />
                    {resolvedWalkIn && <p className="text-xs text-primary mt-1">✓ Account found — passes will be available</p>}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {showPaymentStep && (
              <div className="border-t pt-4 space-y-3">
                <PaymentMethodSelector
                  userId={effectiveUserId || null}
                  memberId={effectiveMemberId || null}
                  isMember={effectiveIsMember}
                  selectedMethod={paymentMethod}
                  onMethodChange={(m) => { if (m === "sell") { setShowSellPackage(true); setPaymentMethod("sell"); } else { setPaymentMethod(m); } }}
                  selectedPassId={selectedPassId}
                  onPassIdChange={setSelectedPassId}
                  selectedCreditId={selectedCreditId}
                  onCreditIdChange={setSelectedCreditId}
                  dropInRate={dropInRate}
                  onDropInRateChange={setDropInRate}
                  isFundraiser={isFundraiserSession}
                  fundraiserAmountCents={fundraiserAmountCents}
                />
                <Button className="w-full" disabled={!canSubmit || addToClassMutation.isPending} onClick={() => addToClassMutation.mutate()}>
                  {addToClassMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Add to Class
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Roster / Waitlist */}
      <Tabs value={rosterTab} onValueChange={(v) => setRosterTab(v as "roster" | "waitlist")}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="roster">Roster ({bookings.length})</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist ({waitlist.length})</TabsTrigger>
          </TabsList>
          {rosterTab === "roster" && (() => {
            const remaining = bookings.filter(a => !a.isAdminHold && !a.isCheckedIn && !a.isNoShow);
            if (remaining.length === 0) return null;
            return (
              <Button
                size="sm"
                variant="outline"
                disabled={bulkNoShowMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Mark all ${remaining.length} remaining attendee${remaining.length === 1 ? "" : "s"} as no-show? Their credits/passes will NOT be refunded.`)) return;
                  bulkNoShowMutation.mutate(remaining.map(a => a.bookingId));
                }}
              >
                <UserX className="h-4 w-4 mr-1" /> Mark remaining as No Show ({remaining.length})
              </Button>
            );
          })()}
        </div>



        <TabsContent value="roster">
          <Card>
            <CardContent className="p-0">
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No one registered yet</p>
                  <p className="text-sm mt-1">Use "Add to Class" above to add participants.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                   <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...bookings].sort((a, b) => Number(b.isAdminHold) - Number(a.isAdminHold)).map((attendee) => {
                      const initials = attendee.name.split(" ").map(n => n[0] || "").join("").slice(0, 2) || "?";
                      const typeLabel = attendee.type === "member" ? "Member" : attendee.type === "pass_holder" ? "Pass Holder" : attendee.type === "walk_in" ? "Walk-In" : "Account";
                      if (attendee.isAdminHold) {
                        return (
                          <TableRow key={attendee.bookingId} className="bg-amber-50/60 dark:bg-amber-950/20">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                  <Lock className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                                </div>
                                <div>
                                  <span className="font-medium text-amber-900 dark:text-amber-100">{attendee.name}</span>
                                  <p className="text-xs text-muted-foreground">Admin hold — name pending</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><span className="text-xs text-muted-foreground">—</span></TableCell>
                            <TableCell>
                              <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs">HOLD</Badge>
                            </TableCell>
                            <TableCell><span className="text-sm text-muted-foreground">—</span></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">Reserved</Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setConvertEntry({ bookingId: attendee.bookingId, defaultName: attendee.name });
                                  setConvertFirst(""); setConvertLast(""); setConvertPhone(""); setConvertEmail("");
                                }}
                              >
                                <UserCog className="h-4 w-4 mr-1" /> Convert
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => releaseHoldMutation.mutate(attendee.bookingId)}
                                disabled={releaseHoldMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <TableRow key={attendee.bookingId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium">{attendee.name}</span>
                                  {(() => {
                                    const s = rosterStats?.get(attendee.bookingId);
                                    if (!s) return null;
                                    const awayFrom =
                                      s.next_milestone != null ? s.next_milestone - s.prior_total : null;
                                    return (
                                      <>
                                        {s.is_first_visit && (
                                          <Badge className="h-5 px-1.5 text-[10px] gap-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                                            <Sparkles className="h-2.5 w-2.5" /> First visit!
                                          </Badge>
                                        )}
                                        {s.is_first_in_type && !s.is_first_visit && (
                                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                                            <Sparkles className="h-2.5 w-2.5" /> First {s.class_type_name || "class"}
                                          </Badge>
                                        )}
                                        {s.total_classes > 0 && (
                                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-0.5">
                                            <Trophy className="h-2.5 w-2.5" /> {s.total_classes}
                                          </Badge>
                                        )}
                                        {!s.milestone_hit && awayFrom != null && awayFrom > 0 && awayFrom <= 2 && (
                                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                                            <Trophy className="h-2.5 w-2.5" />
                                            {awayFrom === 1 ? `1 from ${s.next_milestone}!` : `${awayFrom} from ${s.next_milestone}`}
                                          </Badge>
                                        )}
                                        {s.milestone_hit && (
                                          <Badge className="h-5 px-1.5 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                                            🎉 {s.total_classes}th class!
                                          </Badge>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                                {attendee.email && <p className="text-xs text-muted-foreground">{attendee.email}</p>}
                              </div>

                            </div>
                          </TableCell>
                          <TableCell>
                            {attendee.phone ? (
                              <span className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {attendee.phone}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={attendee.type === "member" ? "secondary" : "outline"} className="text-xs">{typeLabel}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{paymentLabel(attendee.paymentMethod)}</span>
                          </TableCell>
                          <TableCell>
                            {attendee.isNoShow ? (
                              <Badge variant="outline" className="text-muted-foreground"><UserX className="h-3 w-3 mr-1" /> No Show</Badge>
                            ) : attendee.isCheckedIn ? (
                              <Badge variant="default" className="bg-primary"><CheckCircle className="h-3 w-3 mr-1" /> Checked In</Badge>
                            ) : (
                              <Badge variant="secondary">Registered</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {!attendee.isCheckedIn && !attendee.isNoShow && (
                              <Button size="sm" variant="outline" onClick={() => checkInMutation.mutate(attendee.bookingId)} disabled={checkInMutation.isPending}>
                                <UserCheck className="h-4 w-4 mr-1" /> Check In
                              </Button>
                            )}
                            {!attendee.isCheckedIn && !attendee.isNoShow && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (!window.confirm(`Mark ${attendee.name} as no-show? Their class credit/pass will NOT be refunded.`)) return;
                                  noShowMutation.mutate(attendee.bookingId);
                                }}
                                disabled={noShowMutation.isPending}
                                title="Mark as no-show (credit/pass not refunded)"
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                            {!attendee.isNoShow && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (attendee.isCheckedIn) {
                                    if (!window.confirm("Undo check-in and refund this attendee? Their credit/pass will be returned and they'll be notified.")) return;
                                  }
                                  removeMutation.mutate(attendee.bookingId);
                                }}
                                disabled={removeMutation.isPending}
                                title={attendee.isCheckedIn ? "Undo check-in & refund" : "Remove from class"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {attendee.isNoShow && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => undoNoShowMutation.mutate([attendee.bookingId])}
                                disabled={undoNoShowMutation.isPending}
                                title="Undo No Show — restore to Registered"
                              >
                                <RotateCcw className="h-4 w-4 mr-1" /> Undo No Show
                              </Button>
                            )}
                          </TableCell>

                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist">
          <Card>
            <CardContent className="p-0">
              {waitlistLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : waitlist.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No one on the waitlist</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waitlist.map((entry) => {
                      const name = entry.profile ? `${entry.profile.first_name || ""} ${entry.profile.last_name || ""}`.trim() : "Unknown";
                      const initials = entry.profile ? `${entry.profile.first_name?.[0] || ""}${entry.profile.last_name?.[0] || ""}` : "?";
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">{initials}</div>
                              <div>
                                <p className="font-medium">{name}</p>
                                {entry.profile?.email && <p className="text-xs text-muted-foreground">{entry.profile.email}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {entry.status === "notified"
                              ? <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Notified</Badge>
                              : <Badge variant="secondary" className="text-xs">Waiting</Badge>}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {entry.payment_method && !entry.hold_refunded && (
                              <Badge variant="secondary" className="mr-2 text-[10px]">
                                {entry.payment_method === "credits" ? "Credit held" : entry.payment_method === "pass" ? "Pass held" : "Held"}
                              </Badge>
                            )}
                            <Button size="sm" variant="outline" onClick={async () => {
                              // Resolve memberId for this user (active member only)
                              const { data: member } = await supabase
                                .from("members")
                                .select("id")
                                .eq("user_id", entry.user_id)
                                .eq("status", "active")
                                .maybeSingle();
                              setPromoteEntry({ id: entry.id, user_id: entry.user_id, memberId: member?.id || null, name });
                              // Default to whatever was held on the waitlist row
                              const heldMethod = !entry.hold_refunded ? entry.payment_method : null;
                              setPromoteMethod((heldMethod as PaymentOption) || null);
                              setPromotePassId(heldMethod === "pass" ? entry.pass_id : null);
                              setPromoteCreditId(heldMethod === "credits" ? entry.member_credit_id : null);
                              setPromoteDropInRate(member ? "member" : "nonmember");
                            }} disabled={promoteMutation.isPending}>
                              <ArrowUp className="h-4 w-4 mr-1" /> Promote
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeWaitlistMutation.mutate(entry.id)} disabled={removeWaitlistMutation.isPending}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sell Package Dialog */}
      <SellClassPackage
        open={showSellPackage}
        onOpenChange={(o) => {
          setShowSellPackage(o);
          if (!o) {
            queryClient.invalidateQueries({ queryKey: ["roster-passes", effectiveUserId] });
            setPaymentMethod("pass");
          }
        }}
        userId={effectiveUserId || undefined}
      />

      {/* Promote-from-Waitlist Dialog */}
      <Dialog open={!!promoteEntry} onOpenChange={(o) => { if (!o) setPromoteEntry(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Promote from Waitlist</DialogTitle>
            <DialogDescription>
              How should {promoteEntry?.name || "this person"} pay for the class?
            </DialogDescription>
          </DialogHeader>
          {promoteEntry && (
            <PaymentMethodSelector
              userId={promoteEntry.user_id}
              memberId={promoteEntry.memberId}
              isMember={!!promoteEntry.memberId}
              selectedMethod={promoteMethod}
              onMethodChange={setPromoteMethod}
              selectedPassId={promotePassId}
              onPassIdChange={setPromotePassId}
              selectedCreditId={promoteCreditId}
              onCreditIdChange={setPromoteCreditId}
              dropInRate={promoteDropInRate}
              onDropInRateChange={setPromoteDropInRate}
              isFundraiser={isFundraiserSession}
              fundraiserAmountCents={fundraiserAmountCents}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteEntry(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!promoteEntry || !promoteMethod) return;
                promoteMutation.mutate({
                  waitlistId: promoteEntry.id,
                  userId: promoteEntry.user_id,
                  memberId: promoteEntry.memberId,
                  method: promoteMethod,
                  passId: promotePassId,
                  creditId: promoteCreditId,
                  dropInRate: promoteDropInRate,
                });
              }}
              disabled={
                !promoteMethod ||
                promoteMethod === "sell" ||
                (promoteMethod === "pass" && !promotePassId) ||
                promoteMutation.isPending
              }
            >
              {promoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Slots dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold seats</DialogTitle>
            <DialogDescription>
              Reserve seats so they can't be booked publicly. Convert each held seat into a real attendee later, or release it if it's no longer needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Number of seats to hold</Label>
              <Input
                type="number"
                min={1}
                max={Math.max(1, session ? session.max_capacity - bookings.length : 1)}
                value={holdCount}
                onChange={(e) => setHoldCount(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {session ? `${session.max_capacity - bookings.length} seat${session.max_capacity - bookings.length === 1 ? "" : "s"} remaining` : ""}
              </p>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder="e.g. Reserved at door, name pending"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => holdSlotsMutation.mutate({ count: holdCount, note: holdNote })}
              disabled={holdSlotsMutation.isPending}
            >
              {holdSlotsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Hold ${holdCount} seat${holdCount === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Hold dialog */}
      <Dialog open={!!convertEntry} onOpenChange={(o) => { if (!o) setConvertEntry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert hold to attendee</DialogTitle>
            <DialogDescription>
              Enter the person's details. If their email matches an existing account, we'll link it automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First name *</Label><Input value={convertFirst} onChange={(e) => setConvertFirst(e.target.value)} /></div>
              <div><Label>Last name *</Label><Input value={convertLast} onChange={(e) => setConvertLast(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone *</Label><Input value={convertPhone} onChange={(e) => setConvertPhone(e.target.value)} type="tel" /></div>
              <div><Label>Email</Label><Input value={convertEmail} onChange={(e) => setConvertEmail(e.target.value)} type="email" placeholder="Optional" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertEntry(null)}>Cancel</Button>
            <Button
              onClick={() => convertEntry && convertHoldMutation.mutate({
                bookingId: convertEntry.bookingId,
                first: convertFirst, last: convertLast, phone: convertPhone, email: convertEmail,
              })}
              disabled={convertHoldMutation.isPending || !convertFirst.trim() || !convertLast.trim() || !convertPhone.trim()}
            >
              {convertHoldMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save attendee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
