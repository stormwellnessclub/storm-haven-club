import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, CheckCircle, Loader2, UserPlus, Trash2, UserCheck, X, Clock, ArrowUp, XCircle,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseTimeToDb } from "@/lib/softLaunchSchedule";
import type { ClassEntry } from "@/lib/softLaunchSchedule";
import { PersonSearch, type PersonResult } from "./roster/PersonSearch";
import { PaymentMethodSelector, type PaymentOption } from "./roster/PaymentMethodSelector";
import { SellClassPackage } from "./SellClassPackage";

interface ScheduleSlot {
  entry: ClassEntry;
  dateStr: string;
  dbSessionId: string | null;
  enrolled: number;
  maxCapacity: number;
  isCancelled: boolean;
}

interface ClassBooking {
  id: string;
  user_id: string;
  member_id: string | null;
  status: string;
  checked_in_at: string | null;
  walk_in_name: string | null;
  payment_method: string | null;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
  } | null;
}

interface ClassRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSlot: ScheduleSlot | null;
  selectedDate: Date;
  dateStr: string;
}

export function ClassRosterDialog({
  open, onOpenChange, selectedSlot, selectedDate, dateStr,
}: ClassRosterDialogProps) {
  const queryClient = useQueryClient();

  // Add panel state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addTab, setAddTab] = useState<"search" | "walkin">("search");

  // Person search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);

  // Walk-in state
  const [walkInFirst, setWalkInFirst] = useState("");
  const [walkInLast, setWalkInLast] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentOption | null>(null);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [dropInRate, setDropInRate] = useState<"member" | "nonmember">("nonmember");

  // Sell package dialog
  const [showSellPackage, setShowSellPackage] = useState(false);

  // Walk-in email lookup
  const [resolvedWalkIn, setResolvedWalkIn] = useState<{ userId: string | null; memberId: string | null } | null>(null);

  // Resolve walk-in email to existing account
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

  // Current person context for payment selector
  const effectiveUserId = addTab === "search" ? selectedPerson?.userId : resolvedWalkIn?.userId;
  const effectiveMemberId = addTab === "search" ? selectedPerson?.memberId : resolvedWalkIn?.memberId;
  const effectiveIsMember = addTab === "search" ? selectedPerson?.type === "member" : !!resolvedWalkIn?.memberId;

  // Show payment step?
  const showPaymentStep = addTab === "search"
    ? !!selectedPerson
    : !!(walkInFirst.trim() && walkInLast.trim());

  // Fetch bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId],
    queryFn: async () => {
      if (!selectedSlot?.dbSessionId) return [];
      const { data, error } = await supabase
        .from("class_bookings")
        .select("id, user_id, member_id, status, checked_in_at, walk_in_name, payment_method, members (id, first_name, last_name, photo_url)")
        .eq("session_id", selectedSlot.dbSessionId)
        .in("status", ["confirmed", "completed"]);
      if (error) throw error;
      const bookingsData = (data || []) as ClassBooking[];

      // Secondary lookup: fetch profiles for bookings without a members record
      const missingUserIds = bookingsData
        .filter(b => !b.members && b.user_id)
        .map(b => b.user_id);

      if (missingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", missingUserIds);

        if (profiles?.length) {
          const profileMap = new Map(profiles.map(p => [p.user_id, p]));
          for (const booking of bookingsData) {
            if (!booking.members && booking.user_id) {
              booking.profile = profileMap.get(booking.user_id) || null;
            }
          }
        }
      }

      // Auto-heal: if actual confirmed count differs from current_enrollment, fix it silently
      if (selectedSlot?.dbSessionId) {
        const confirmedCount = bookingsData.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
        if (confirmedCount !== selectedSlot.enrolled) {
          await supabase
            .from("class_sessions")
            .update({ current_enrollment: confirmedCount })
            .eq("id", selectedSlot.dbSessionId);
          // Invalidate the sessions query so the parent grid updates
          queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions"] });
        }
      }

      return bookingsData;
    },
    enabled: !!selectedSlot?.dbSessionId && open,
  });

  // Fetch waitlist for session
  const { data: waitlist = [], isLoading: waitlistLoading } = useQuery({
    queryKey: ["session-waitlist", selectedSlot?.dbSessionId],
    queryFn: async () => {
      if (!selectedSlot?.dbSessionId) return [];
      const { data, error } = await supabase
        .from("class_waitlist")
        .select("id, user_id, position, status, notified_at, claimed_at, claim_expires_at, created_at")
        .eq("session_id", selectedSlot.dbSessionId)
        .in("status", ["waiting", "notified"])
        .order("position", { ascending: true });
      if (error) throw error;

      // Resolve user names from profiles
      if (!data?.length) return [];
      const userIds = data.map(w => w.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      return data.map(w => ({
        ...w,
        profile: profileMap.get(w.user_id) || null,
      }));
    },
    enabled: !!selectedSlot?.dbSessionId && open,
  });

  // Roster/waitlist tab state
  const [rosterTab, setRosterTab] = useState<"roster" | "waitlist">("roster");

  // Helper to ensure session exists
  const ensureSession = async () => {
    if (!selectedSlot) throw new Error("No slot selected");
    const dbTime = parseTimeToDb(selectedSlot.entry.time);
    const [h, m] = dbTime.split(":").map(Number);
    const totalMin = h * 60 + m + 50;
    const endTime = `${Math.floor(totalMin / 60).toString().padStart(2, "0")}:${(totalMin % 60).toString().padStart(2, "0")}:00`;

    const { data: sessionId, error } = await (supabase.rpc as any)(
      "find_or_create_temp_class_session",
      {
        _class_name: selectedSlot.entry.name,
        _session_date: selectedSlot.dateStr,
        _start_time: dbTime,
        _end_time: endTime,
        _max_capacity: 8,
      }
    );
    if (error) throw error;
    if (!sessionId) throw new Error("Failed to create session");
    return sessionId;
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["soft-launch-bookings", selectedSlot?.dbSessionId] });
    queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions", dateStr] });
    queryClient.invalidateQueries({ queryKey: ["session-waitlist", selectedSlot?.dbSessionId] });
  };

  // Check in mutation
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

  // Remove booking mutation — with credit/pass refund
  const removeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      // First fetch the booking to check payment details
      const { data: booking, error: fetchErr } = await supabase
        .from("class_bookings")
        .select("id, payment_method, pass_id, member_credit_id, credits_used")
        .eq("id", bookingId)
        .single();
      if (fetchErr || !booking) throw new Error("Booking not found");

      // Refund credit if paid with credits
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

      // Refund pass if paid with pass
      if (booking.payment_method === "pass" && booking.pass_id) {
        const { data: pass } = await supabase
          .from("class_passes")
          .select("classes_remaining, status")
          .eq("id", booking.pass_id)
          .single();
        if (pass) {
          await supabase
            .from("class_passes")
            .update({
              classes_remaining: pass.classes_remaining + 1,
              status: "active" as any,
            })
            .eq("id", booking.pass_id);
        }
      }

      // Cancel the booking
      const { error } = await supabase
        .from("class_bookings")
        .update({ status: "cancelled" as const, cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;

      // Decrement enrollment
      if (selectedSlot?.dbSessionId) {
        await supabase
          .from("class_sessions")
          .update({ current_enrollment: Math.max(0, selectedSlot.enrolled - 1) })
          .eq("id", selectedSlot.dbSessionId);
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Removed from class — credit/pass restored"); },
    onError: () => toast.error("Failed to remove"),
  });

  // Promote waitlisted person into class
  const promoteMutation = useMutation({
    mutationFn: async (waitlistEntry: { id: string; user_id: string }) => {
      if (!selectedSlot?.dbSessionId) throw new Error("No session");

      // Get member_id if exists
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", waitlistEntry.user_id)
        .eq("status", "active")
        .maybeSingle();

      // Create a comp booking for promoted waitlist person
      await supabase.from("class_bookings").insert({
        session_id: selectedSlot.dbSessionId,
        user_id: waitlistEntry.user_id,
        member_id: member?.id || null,
        status: "confirmed",
        payment_method: "comp",
        booked_at: new Date().toISOString(),
      });

      // Update enrollment
      await supabase
        .from("class_sessions")
        .update({ current_enrollment: selectedSlot.enrolled + 1 })
        .eq("id", selectedSlot.dbSessionId);

      // Mark waitlist entry as claimed
      await supabase
        .from("class_waitlist")
        .update({ status: "claimed" as any, claimed_at: new Date().toISOString() })
        .eq("id", waitlistEntry.id);
    },
    onSuccess: () => { invalidateAll(); toast.success("Promoted from waitlist"); },
    onError: () => toast.error("Failed to promote"),
  });

  // Remove from waitlist
  const removeWaitlistMutation = useMutation({
    mutationFn: async (waitlistId: string) => {
      await supabase
        .from("class_waitlist")
        .update({ status: "expired" as any })
        .eq("id", waitlistId);
    },
    onSuccess: () => { invalidateAll(); toast.success("Removed from waitlist"); },
    onError: () => toast.error("Failed to remove from waitlist"),
  });

  // Main add-to-class mutation
  const addToClassMutation = useMutation({
    mutationFn: async () => {
      if (!paymentMethod) throw new Error("Select a payment method");

      const sessionId = await ensureSession();
      const userId = effectiveUserId || null;
      const memberId = effectiveMemberId || null;
      const walkInName = addTab === "walkin" ? `${walkInFirst.trim()} ${walkInLast.trim()}` : null;

      // Check for existing booking
      if (userId) {
        const { data: existing } = await supabase
          .from("class_bookings")
          .select("id")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .eq("status", "confirmed")
          .maybeSingle();
        if (existing) throw new Error("This person is already booked");
      }

      // Handle payment-specific logic
      if (paymentMethod === "pass") {
        if (!selectedPassId) throw new Error("Select a class pass");
        // Deduct pass
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
          session_id: sessionId,
          user_id: userId,
          member_id: memberId,
          status: "confirmed",
          payment_method: "pass",
          pass_id: selectedPassId,
          walk_in_name: walkInName,
          booked_at: new Date().toISOString(),
        });
      } else if (paymentMethod === "credits") {
        const creditId = selectedCreditId || null;
        if (!creditId && !memberId) throw new Error("No credits available");

        // If no specific credit selected, pick first available
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

        const { data: credit, error: credErr } = await supabase
          .from("member_credits")
          .select("credits_remaining")
          .eq("id", targetCreditId!)
          .single();
        if (credErr || !credit || credit.credits_remaining <= 0) throw new Error("No credits remaining");

        await supabase
          .from("member_credits")
          .update({ credits_remaining: credit.credits_remaining - 1 })
          .eq("id", targetCreditId!);

        await supabase.from("class_bookings").insert({
          session_id: sessionId,
          user_id: userId,
          member_id: memberId,
          status: "confirmed",
          payment_method: "credits",
          member_credit_id: targetCreditId,
          credits_used: 1,
          walk_in_name: walkInName,
          booked_at: new Date().toISOString(),
        });
      } else if (paymentMethod === "dropin") {
        const amountCents = dropInRate === "member" ? 2500 : 3000;

        await supabase.from("class_bookings").insert({
          session_id: sessionId,
          user_id: userId,
          member_id: memberId,
          status: "confirmed",
          payment_method: "walk_in",
          amount_paid: amountCents,
          walk_in_name: walkInName,
          booked_at: new Date().toISOString(),
        });

        // Try to charge if member has card
        if (memberId) {
          try {
            const { data, error: chargeErr } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "charge_saved_card",
                memberId,
                amount: amountCents,
                description: `Drop-in: ${selectedSlot?.entry.name} on ${selectedSlot?.dateStr}`,
              },
            });
            if (chargeErr || !data?.success) {
              toast.info(`Booking added — collect $${(amountCents / 100).toFixed(2)} at desk`, { duration: 5000 });
              return;
            }
          } catch {
            toast.info(`Booking added — collect $${(amountCents / 100).toFixed(2)} at desk`, { duration: 5000 });
            return;
          }
        } else {
          toast.info(`Booking added — collect $${(amountCents / 100).toFixed(2)} drop-in fee at desk`, { duration: 5000 });
          return;
        }
      } else if (paymentMethod === "comp") {
        await supabase.from("class_bookings").insert({
          session_id: sessionId,
          user_id: userId,
          member_id: memberId,
          status: "confirmed",
          payment_method: "comp",
          walk_in_name: walkInName,
          booked_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["roster-passes"] });
      queryClient.invalidateQueries({ queryKey: ["roster-credits"] });
      resetForm();
      toast.success("Added to class");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add"),
  });

  // Can submit?
  const canSubmit = (() => {
    if (!paymentMethod) return false;
    if (paymentMethod === "pass" && !selectedPassId) return false;
    if (paymentMethod === "sell") return false; // handled separately
    if (addTab === "walkin" && (!walkInFirst.trim() || !walkInLast.trim())) return false;
    if (addTab === "search" && !selectedPerson) return false;
    return true;
  })();

  const getDisplayName = (booking: ClassBooking) => {
    if (booking.members) return `${booking.members.first_name} ${booking.members.last_name}`;
    if (booking.profile?.first_name || booking.profile?.last_name) {
      return `${booking.profile.first_name || ""} ${booking.profile.last_name || ""}`.trim();
    }
    if (booking.walk_in_name) return booking.walk_in_name;
    if (booking.profile?.email) return booking.profile.email;
    return "Unknown";
  };

  const getInitials = (booking: ClassBooking) => {
    if (booking.members) return `${booking.members.first_name?.[0] || ""}${booking.members.last_name?.[0] || ""}`;
    if (booking.profile?.first_name || booking.profile?.last_name) {
      return `${booking.profile.first_name?.[0] || ""}${booking.profile.last_name?.[0] || ""}`;
    }
    if (booking.walk_in_name) {
      const parts = booking.walk_in_name.split(" ");
      return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`;
    }
    if (booking.profile?.email) return booking.profile.email[0]?.toUpperCase() || "?";
    return "?";
  };

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

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}
      >
        <SheetContent side="right" className="!w-full !max-w-none sm:!max-w-2xl flex flex-col p-0 h-full">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>
              {selectedSlot?.entry.name} — {format(selectedDate, "MMM d")} at {selectedSlot?.entry.time}
            </SheetTitle>
            <SheetDescription>
              {selectedSlot?.dbSessionId ? `${bookings.length} registered` : "No bookings yet"}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0 overflow-hidden px-6 pb-6">

          {/* Add Button */}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => { setShowAddPanel(!showAddPanel); if (showAddPanel) resetForm(); }}>
              <UserPlus className="h-4 w-4 mr-1" /> {showAddPanel ? "Close" : "Add to Class"}
            </Button>
          </div>

          {/* Add Panel */}
          {showAddPanel && (
            <div className="border rounded-sm p-3 space-y-3">
              <Tabs value={addTab} onValueChange={(v) => { setAddTab(v as "search" | "walkin"); setSelectedPerson(null); setPaymentMethod(null); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search">Find Person</TabsTrigger>
                  <TabsTrigger value="walkin">Walk-In / New</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-3 mt-2">
                  {!selectedPerson ? (
                    <PersonSearch
                      search={searchQuery}
                      onSearchChange={setSearchQuery}
                      onSelect={(p) => {
                        setSelectedPerson(p);
                        setSearchQuery("");
                        setDropInRate(p.type === "member" ? "member" : "nonmember");
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-between p-2 border rounded-sm bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {selectedPerson.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{selectedPerson.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedPerson.email}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {selectedPerson.type === "member" ? "Member" : selectedPerson.type === "pass_holder" ? "Pass Holder" : "Account"}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedPerson(null); setPaymentMethod(null); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="walkin" className="space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>First Name *</Label>
                      <Input value={walkInFirst} onChange={(e) => setWalkInFirst(e.target.value)} placeholder="First name" />
                    </div>
                    <div>
                      <Label>Last Name *</Label>
                      <Input value={walkInLast} onChange={(e) => setWalkInLast(e.target.value)} placeholder="Last name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Email</Label>
                      <Input value={walkInEmail} onChange={(e) => setWalkInEmail(e.target.value)} placeholder="Optional — links passes" type="email" />
                      {resolvedWalkIn && (
                        <p className="text-xs text-primary mt-1">✓ Account found — passes will be available</p>
                      )}
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="Optional" type="tel" />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Payment Method Selector */}
              {showPaymentStep && (
                <>
                  <div className="border-t pt-3">
                    <PaymentMethodSelector
                      userId={effectiveUserId || null}
                      memberId={effectiveMemberId || null}
                      isMember={effectiveIsMember}
                      selectedMethod={paymentMethod}
                      onMethodChange={(m) => {
                        if (m === "sell") {
                          setShowSellPackage(true);
                          setPaymentMethod("sell");
                        } else {
                          setPaymentMethod(m);
                        }
                      }}
                      selectedPassId={selectedPassId}
                      onPassIdChange={setSelectedPassId}
                      selectedCreditId={selectedCreditId}
                      onCreditIdChange={setSelectedCreditId}
                      dropInRate={dropInRate}
                      onDropInRateChange={setDropInRate}
                    />
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!canSubmit || addToClassMutation.isPending}
                    onClick={() => addToClassMutation.mutate()}
                  >
                    {addToClassMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Add to Class
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Roster / Waitlist Tabs */}
          <Tabs value={rosterTab} onValueChange={(v) => setRosterTab(v as "roster" | "waitlist")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="roster">Roster ({bookings.length})</TabsTrigger>
              <TabsTrigger value="waitlist">Waitlist ({waitlist.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="roster">
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !selectedSlot?.dbSessionId || bookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No one registered for this class yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => {
                      const isCheckedIn = booking.status === "completed" || !!booking.checked_in_at;
                      const isWalkIn = !booking.member_id && !!booking.walk_in_name;
                      return (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {getInitials(booking)}
                              </div>
                              <span>{getDisplayName(booking)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isWalkIn ? (
                              <Badge variant="outline" className="text-xs">Walk-In</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Member</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{paymentLabel(booking.payment_method)}</span>
                          </TableCell>
                          <TableCell>
                            {isCheckedIn ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" /> Checked In
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Registered</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {!isCheckedIn && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => checkInMutation.mutate(booking.id)} disabled={checkInMutation.isPending}>
                                  <UserCheck className="h-4 w-4 mr-1" /> Check In
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeMutation.mutate(booking.id)} disabled={removeMutation.isPending}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="waitlist">
              {waitlistLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : waitlist.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No one on the waitlist</p>
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
                      const name = entry.profile
                        ? `${entry.profile.first_name || ""} ${entry.profile.last_name || ""}`.trim()
                        : "Unknown";
                      const initials = entry.profile
                        ? `${entry.profile.first_name?.[0] || ""}${entry.profile.last_name?.[0] || ""}`
                        : "?";
                      const statusBadge = entry.status === "notified"
                        ? <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Notified</Badge>
                        : <Badge variant="secondary" className="text-xs">Waiting</Badge>;

                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {initials}
                              </div>
                              <div>
                                <p className="text-sm">{name}</p>
                                {entry.profile?.email && (
                                  <p className="text-xs text-muted-foreground">{entry.profile.email}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => promoteMutation.mutate({ id: entry.id, user_id: entry.user_id })}
                              disabled={promoteMutation.isPending}
                            >
                              <ArrowUp className="h-4 w-4 mr-1" /> Promote
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeWaitlistMutation.mutate(entry.id)}
                              disabled={removeWaitlistMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Sell Package Dialog */}
      <SellClassPackage
        open={showSellPackage}
        onOpenChange={(o) => {
          setShowSellPackage(o);
          if (!o) {
            // After selling, refresh passes and auto-select pass method
            queryClient.invalidateQueries({ queryKey: ["roster-passes", effectiveUserId] });
            setPaymentMethod("pass");
          }
        }}
        userId={effectiveUserId || undefined}
      />
    </>
  );
}
