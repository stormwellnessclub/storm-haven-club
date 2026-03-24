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
  Users, CheckCircle, Loader2, UserPlus, Trash2, UserCheck, X, Clock, ArrowUp, XCircle, ArrowLeft, Phone,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonSearch, type PersonResult } from "@/components/admin/roster/PersonSearch";
import { PaymentMethodSelector, type PaymentOption } from "@/components/admin/roster/PaymentMethodSelector";
import { SellClassPackage } from "@/components/admin/SellClassPackage";
import { resolveRosterIdentities, type RosterAttendee } from "@/hooks/useRosterIdentity";

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
        .select("id, session_date, start_time, end_time, max_capacity, current_enrollment, is_cancelled, class_types!inner(name)")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  const className = session ? (Array.isArray(session.class_types) ? session.class_types[0]?.name : (session.class_types as any)?.name) : "";
  const sessionDate = session?.session_date ? new Date(session.session_date + "T00:00:00") : new Date();

  // Fetch bookings using shared resolver
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["class-roster-bookings", sessionId],
    queryFn: async () => {
      const attendees = await resolveRosterIdentities(sessionId!);

      // Auto-heal enrollment counter
      const confirmedCount = attendees.length;
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

  // Fetch waitlist
  const { data: waitlist = [], isLoading: waitlistLoading } = useQuery({
    queryKey: ["class-roster-waitlist", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_waitlist")
        .select("id, user_id, position, status, notified_at, claimed_at, claim_expires_at, created_at")
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

  // Remove booking mutation with credit/pass refund
  const removeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data: booking, error: fetchErr } = await supabase
        .from("class_bookings")
        .select("id, payment_method, pass_id, member_credit_id, credits_used")
        .eq("id", bookingId)
        .single();
      if (fetchErr || !booking) throw new Error("Booking not found");

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
        .update({ status: "cancelled" as const, cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Removed from class — credit/pass restored"); },
    onError: () => toast.error("Failed to remove"),
  });

  // Promote from waitlist
  const promoteMutation = useMutation({
    mutationFn: async (waitlistEntry: { id: string; user_id: string }) => {
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", waitlistEntry.user_id)
        .eq("status", "active")
        .maybeSingle();

      await supabase.from("class_bookings").insert({
        session_id: sessionId!,
        user_id: waitlistEntry.user_id,
        member_id: member?.id || null,
        status: "confirmed",
        payment_method: "comp",
        booked_at: new Date().toISOString(),
      });

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

  // Add to class mutation
  const addToClassMutation = useMutation({
    mutationFn: async () => {
      if (!paymentMethod) throw new Error("Select a payment method");
      const userId = effectiveUserId || null;
      const memberId = effectiveMemberId || null;
      const walkInName = addTab === "walkin" ? `${walkInFirst.trim()} ${walkInLast.trim()}` : null;
      const walkInEmailVal = addTab === "walkin" && walkInEmail.trim() ? walkInEmail.trim() : null;
      const walkInPhoneVal = addTab === "walkin" && walkInPhone.trim() ? walkInPhone.trim() : null;

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
        const amountCents = dropInRate === "member" ? 2500 : 3000;
        await supabase.from("class_bookings").insert({
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "walk_in", amount_paid: amountCents,
          walk_in_name: walkInName, booked_at: new Date().toISOString(),
        });

        if (memberId) {
          try {
            const { data, error: chargeErr } = await supabase.functions.invoke("stripe-payment", {
              body: { action: "charge_saved_card", memberId, amount: amountCents, description: `Drop-in: ${className} on ${session?.session_date}` },
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
          session_id: sessionId!, user_id: userId, member_id: memberId,
          status: "confirmed", payment_method: "comp", walk_in_name: walkInName,
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
            <p className="text-2xl font-bold">{bookings.length}/{session.max_capacity}</p>
            <p className="text-xs text-muted-foreground">Enrolled</p>
          </div>
          {session.is_cancelled && <Badge variant="destructive">Cancelled</Badge>}
        </div>
      </div>

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
        <TabsList>
          <TabsTrigger value="roster">Roster ({bookings.length})</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist ({waitlist.length})</TabsTrigger>
        </TabsList>

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
                    {bookings.map((attendee) => {
                      const initials = attendee.name.split(" ").map(n => n[0] || "").join("").slice(0, 2) || "?";
                      const typeLabel = attendee.type === "member" ? "Member" : attendee.type === "pass_holder" ? "Pass Holder" : attendee.type === "walk_in" ? "Walk-In" : "Account";
                      return (
                        <TableRow key={attendee.bookingId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {initials}
                              </div>
                              <div>
                                <span className="font-medium">{attendee.name}</span>
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
                            {attendee.isCheckedIn ? (
                              <Badge variant="default" className="bg-primary"><CheckCircle className="h-3 w-3 mr-1" /> Checked In</Badge>
                            ) : (
                              <Badge variant="secondary">Registered</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {!attendee.isCheckedIn && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => checkInMutation.mutate(attendee.bookingId)} disabled={checkInMutation.isPending}>
                                  <UserCheck className="h-4 w-4 mr-1" /> Check In
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeMutation.mutate(attendee.bookingId)} disabled={removeMutation.isPending}>
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
                            <Button size="sm" variant="outline" onClick={() => promoteMutation.mutate({ id: entry.id, user_id: entry.user_id })} disabled={promoteMutation.isPending}>
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
    </div>
  );
}
