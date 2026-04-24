import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Search, FileCheck, ArrowRight, Info, CreditCard } from "lucide-react";
import { useSpaServices, useSpaTherapists, useSpaRooms, useSpaServiceAvailability } from "@/hooks/useSpaManagement";
import { useCheckSpaAvailability, useSpaBookedSlots } from "@/hooks/useSpaBooking";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { parseTimeInput } from "@/lib/parseTimeInput";
import {
  findCoveringSlot,
  hasCoverageOnDate,
  findNextAvailableSlot,
  getServiceWindowForDate,
  latestStartTime,
  generateAvailableStartTimes,
} from "@/lib/spaAvailability";

interface AdminSpaBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
}

export function AdminSpaBookingModal({ open, onOpenChange, defaultDate }: AdminSpaBookingModalProps) {
  const queryClient = useQueryClient();
  const { data: services } = useSpaServices();
  const { data: therapists } = useSpaTherapists();
  const { data: rooms } = useSpaRooms();
  const { data: availability } = useSpaServiceAvailability();

  type CustomerType = "member" | "non_member" | "guest";
  interface SelectedCustomer {
    type: CustomerType;
    memberId: string | null;
    userId: string | null;
    stripeCustomerId: string | null;
    name: string;
    email: string | null;
    waiverSigned: boolean;
    cardBrand: string | null;
    cardLast4: string | null;
  }

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [appointmentTime, setAppointmentTime] = useState(""); // HH:mm internal
  const [timeInputDisplay, setTimeInputDisplay] = useState(""); // what user sees/types
  const [timeError, setTimeError] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState<string>("auto");
  const [roomId, setRoomId] = useState<string>("auto");
  const [staffNotes, setStaffNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("in_person");
  const [conflict, setConflict] = useState<string | null>(null);
  const [resolvedTherapistId, setResolvedTherapistId] = useState<string | null>(null);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null);

  // Unified customer search across members, non-members, and saved guests
  const { data: customerResults } = useQuery({
    queryKey: ["spa-customer-search", customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const term = `%${customerSearch}%`;

      const [membersRes, nonMembersRes, guestsRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, first_name, last_name, email, membership_type, user_id, stripe_customer_id, card_brand, card_last4")
          .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
          .limit(8),
        (supabase.from as any)("non_member_profiles")
          .select("user_id, first_name, last_name, email, stripe_customer_id, card_brand, card_last4, waiver_signed")
          .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
          .limit(8),
        supabase
          .from("guest_passes")
          .select("id, guest_name, guest_email, user_id, stripe_customer_id, card_brand, card_last4")
          .not("stripe_customer_id", "is", null)
          .or(`guest_name.ilike.${term},guest_email.ilike.${term}`)
          .limit(8),
      ]);

      const results: Array<{
        key: string;
        type: CustomerType;
        memberId: string | null;
        userId: string | null;
        stripeCustomerId: string | null;
        name: string;
        email: string | null;
        cardBrand: string | null;
        cardLast4: string | null;
        waiverSigned: boolean | null;
        badgeLabel: string;
      }> = [];

      (membersRes.data || []).forEach((m: any) => {
        results.push({
          key: `m-${m.id}`,
          type: "member",
          memberId: m.id,
          userId: m.user_id || null,
          stripeCustomerId: m.stripe_customer_id || null,
          name: `${m.first_name} ${m.last_name}`.trim(),
          email: m.email || null,
          cardBrand: m.card_brand || null,
          cardLast4: m.card_last4 || null,
          waiverSigned: null,
          badgeLabel: m.membership_type || "Member",
        });
      });

      const seenUserIds = new Set(
        (membersRes.data || []).map((m: any) => m.user_id).filter(Boolean)
      );

      (nonMembersRes.data || []).forEach((nm: any) => {
        if (nm.user_id && seenUserIds.has(nm.user_id)) return; // de-dupe
        results.push({
          key: `nm-${nm.user_id}`,
          type: "non_member",
          memberId: null,
          userId: nm.user_id,
          stripeCustomerId: nm.stripe_customer_id || null,
          name: `${nm.first_name || ""} ${nm.last_name || ""}`.trim() || nm.email || "Non-member",
          email: nm.email || null,
          cardBrand: nm.card_brand || null,
          cardLast4: nm.card_last4 || null,
          waiverSigned: nm.waiver_signed === true,
          badgeLabel: "Non-Member",
        });
      });

      const seenGuestEmails = new Set(
        results.map((r) => (r.email || "").toLowerCase()).filter(Boolean)
      );

      (guestsRes.data || []).forEach((g: any) => {
        const email = (g.guest_email || "").toLowerCase();
        if (email && seenGuestEmails.has(email)) return; // already covered as member/non-member
        results.push({
          key: `g-${g.id}`,
          type: "guest",
          memberId: null,
          userId: g.user_id || null,
          stripeCustomerId: g.stripe_customer_id || null,
          name: g.guest_name || g.guest_email || "Guest",
          email: g.guest_email || null,
          cardBrand: g.card_brand || null,
          cardLast4: g.card_last4 || null,
          waiverSigned: null,
          badgeLabel: "Guest",
        });
      });

      return results.slice(0, 15);
    },
    enabled: customerSearch.length >= 2,
  });

  const checkCustomerWaiver = async (
    type: CustomerType,
    userId: string | null,
    knownWaiver: boolean | null
  ): Promise<boolean> => {
    if (type === "guest") return false; // walk-in guest, no portal account
    if (knownWaiver === true) return true;
    if (!userId) return false;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("waiver_signed")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileData?.waiver_signed) return true;
    const { data: nonMemberData } = await (supabase.from as any)("non_member_profiles")
      .select("waiver_signed")
      .eq("user_id", userId)
      .maybeSingle();
    return nonMemberData?.waiver_signed === true;
  };

  const handleSelectCustomer = async (
    candidate: NonNullable<typeof customerResults>[number]
  ) => {
    const waiver = await checkCustomerWaiver(candidate.type, candidate.userId, candidate.waiverSigned);
    setSelectedCustomer({
      type: candidate.type,
      memberId: candidate.memberId,
      userId: candidate.userId,
      stripeCustomerId: candidate.stripeCustomerId,
      name: candidate.name,
      email: candidate.email,
      waiverSigned: waiver,
      cardBrand: candidate.cardBrand,
      cardLast4: candidate.cardLast4,
    });
    setCustomerSearch("");
  };

  const selectedService = useMemo(
    () => services?.find((s) => s.id === serviceId),
    [services, serviceId]
  );

  const dateObj = useMemo(() => new Date(appointmentDate + "T12:00:00"), [appointmentDate]);

  // Existing bookings on this date — used to filter booked slots out of the grid hint
  const { data: bookedSlots } = useSpaBookedSlots(dateObj);

  // Day-level coverage info for the selected service+date
  const coverageOnDate = useMemo(() => {
    if (!serviceId) return false;
    return hasCoverageOnDate(availability, serviceId, dateObj);
  }, [availability, serviceId, dateObj]);

  // Window hint with last-booking time
  const windowHint = useMemo(() => {
    if (!selectedService) return null;
    const w = getServiceWindowForDate(availability, serviceId, dateObj);
    if (!w) return null;
    const last = latestStartTime(w.end, selectedService.duration_minutes, selectedService.cleanup_minutes);
    return { start: w.start, end: w.end, latestStart: last };
  }, [availability, selectedService, serviceId, dateObj]);

  // Available start times remaining on this date for the selected service & resources.
  // Used to show a "X slots already booked" hint.
  const availableStartTimes = useMemo(() => {
    if (!selectedService || !serviceId) return [];
    return generateAvailableStartTimes(
      availability,
      serviceId,
      dateObj,
      selectedService.duration_minutes,
      selectedService.cleanup_minutes,
      bookedSlots,
      {
        therapistId: therapistId !== "auto" ? therapistId : undefined,
        roomId: roomId !== "auto" ? roomId : undefined,
      }
    );
  }, [availability, selectedService, serviceId, dateObj, bookedSlots, therapistId, roomId]);

  const totalPossibleStartTimes = useMemo(() => {
    if (!selectedService || !serviceId) return 0;
    return generateAvailableStartTimes(
      availability,
      serviceId,
      dateObj,
      selectedService.duration_minutes,
      selectedService.cleanup_minutes
    ).length;
  }, [availability, selectedService, serviceId, dateObj]);

  // Next-available helper for empty days
  const nextAvailable = useMemo(() => {
    if (!selectedService) return null;
    if (coverageOnDate) return null;
    return findNextAvailableSlot(
      availability,
      serviceId,
      dateObj,
      selectedService.duration_minutes,
      selectedService.cleanup_minutes
    );
  }, [availability, selectedService, serviceId, dateObj, coverageOnDate]);

  const checkAvail = useCheckSpaAvailability();

  const runConflictCheck = useCallback(
    async (time: string) => {
      setConflict(null);
      setResolvedTherapistId(null);
      setResolvedRoomId(null);
      if (!selectedService) return;

      const slot = findCoveringSlot(
        availability,
        serviceId,
        dateObj,
        time,
        selectedService.duration_minutes,
        selectedService.cleanup_minutes
      );

      const hasManualTherapist = therapistId !== "auto";
      const hasManualRoom = roomId !== "auto";

      if (!slot && (!hasManualTherapist || !hasManualRoom)) {
        setConflict(
          "That time is outside the configured therapist or room availability for this service. Pick another time, or assign a therapist and room manually to override."
        );
        return;
      }

      const resolvedTherapist = hasManualTherapist ? therapistId : slot?.therapist_id || null;
      const resolvedRoom = hasManualRoom ? roomId : slot?.room_id || null;
      setResolvedTherapistId(resolvedTherapist);
      setResolvedRoomId(resolvedRoom);

      if (!resolvedTherapist && !resolvedRoom) {
        setConflict("Please assign a therapist or room to book this appointment.");
        return;
      }

      try {
        const result = await checkAvail.mutateAsync({
          appointmentDate: dateObj,
          appointmentTime: time,
          durationMinutes: selectedService.duration_minutes,
          cleanupMinutes: selectedService.cleanup_minutes,
          staffId: resolvedTherapist || undefined,
          roomId: resolvedRoom || undefined,
        });
        if (!result.available) {
          const types = new Set(result.conflictingAppointments.map((c: any) => c._conflictType));
          if (types.has("staff") && types.has("room")) {
            setConflict("Both the therapist and treatment room are already booked at this time. Choose another time, therapist, or room.");
          } else if (types.has("room")) {
            setConflict("This treatment room is already booked at that time. Choose another time or room.");
          } else {
            setConflict("This therapist already has a booking at this time. Choose a different time or therapist.");
          }
        }
      } catch {
        // ignore — fail-soft, server will reject if needed
      }
    },
    [selectedService, dateObj, availability, serviceId, therapistId, roomId, checkAvail]
  );

  // Re-run conflict check when therapist/room/date change after a time was set
  useEffect(() => {
    if (appointmentTime) void runConflictCheck(appointmentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId, roomId, appointmentDate]);

  const handleTimeInputBlur = () => {
    if (!timeInputDisplay.trim()) {
      setAppointmentTime("");
      setTimeError(null);
      return;
    }
    const parsed = parseTimeInput(timeInputDisplay);
    if (!parsed) {
      setTimeError("Invalid time. Try e.g. 10:00 AM or 2:30 PM");
      setAppointmentTime("");
      return;
    }
    setTimeError(null);
    setAppointmentTime(parsed);
    setTimeInputDisplay(formatTime12h(parsed));
    runConflictCheck(parsed);
  };

  const handleTimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService || !appointmentTime) throw new Error("Missing required fields");
      if (conflict) throw new Error(conflict);

      const resolvedTherapist = therapistId !== "auto" ? therapistId : resolvedTherapistId || null;
      const resolvedRoom = roomId !== "auto" ? roomId : resolvedRoomId || null;

      if (!resolvedTherapist && !resolvedRoom) {
        throw new Error("Please assign a therapist or room before booking.");
      }

      // Final check via server RPC
      const result = await checkAvail.mutateAsync({
        appointmentDate: dateObj,
        appointmentTime,
        durationMinutes: selectedService.duration_minutes,
        cleanupMinutes: selectedService.cleanup_minutes,
        staffId: resolvedTherapist || undefined,
        roomId: resolvedRoom || undefined,
      });

      if (!result.available) {
        throw new Error("That therapist or room is already blocked for the full service plus cleanup time.");
      }

      let memberUserId: string | null = null;
      if (selectedMemberId) {
        const { data: memberRow } = await supabase
          .from("members")
          .select("user_id")
          .eq("id", selectedMemberId)
          .maybeSingle();
        memberUserId = memberRow?.user_id || null;
      }

      const { error } = await (supabase.from as any)("spa_appointments").insert({
        member_id: selectedMemberId,
        user_id: memberUserId,
        service_id: selectedService.id,
        service_name: selectedService.name,
        service_category: selectedService.category,
        service_price: selectedService.price,
        member_price: selectedService.member_price,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime + ":00",
        duration_minutes: selectedService.duration_minutes,
        cleanup_minutes: selectedService.cleanup_minutes,
        status: "confirmed",
        staff_id: resolvedTherapist,
        room_id: resolvedRoom,
        staff_notes: staffNotes || null,
        payment_method: paymentMethod === "comp" ? "comp" : null,
        amount_paid: paymentMethod === "comp" ? 0 : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-spa-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["spa-appointments"] });
      toast.success("Appointment booked successfully");
      onOpenChange(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setMemberSearch("");
    setSelectedMemberId(null);
    setSelectedMemberName("");
    setServiceId("");
    setAppointmentTime("");
    setTimeInputDisplay("");
    setTimeError(null);
    setTherapistId("auto");
    setRoomId("auto");
    setResolvedTherapistId(null);
    setResolvedRoomId(null);
    setStaffNotes("");
    setPaymentMethod("in_person");
    setConflict(null);
    setSelectedMemberWaiverSigned(false);
  };

  const activeServices = services?.filter((s) => s.is_active) || [];
  const activeTherapists = therapists?.filter((t) => t.is_active) || [];
  const activeRooms = rooms?.filter((r) => r.is_active) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Spa Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Member Search */}
          <div>
            <Label>Member</Label>
            {selectedMemberId ? (
              <div className="flex items-center justify-between p-2 border rounded-md bg-secondary/30">
                <span className="text-sm font-medium">{selectedMemberName}</span>
                <Button size="sm" variant="ghost" onClick={() => { setSelectedMemberId(null); setSelectedMemberName(""); setSelectedMemberWaiverSigned(false); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search member by name or email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                {memberResults && memberResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {memberResults.map((m) => (
                      <button
                        key={m.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setSelectedMemberName(`${m.first_name} ${m.last_name}`);
                          setMemberSearch("");
                          checkMemberWaiver(m.user_id);
                        }}
                      >
                        <span>{m.first_name} {m.last_name}</span>
                        <Badge variant="outline" className="text-xs">{m.membership_type}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedMemberId && !selectedMemberWaiverSigned && (
            <Alert className="bg-destructive/10 border-destructive/30">
              <FileCheck className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive">Liability Waiver Not Signed</AlertTitle>
              <AlertDescription className="mt-1">
                This member has not signed the liability waiver. They must sign it via the member portal before a spa appointment can be booked.
              </AlertDescription>
            </Alert>
          )}

          {/* Service */}
          <div>
            <Label>Service *</Label>
            <Select value={serviceId} onValueChange={(v) => { setServiceId(v); setAppointmentTime(""); setTimeInputDisplay(""); setTimeError(null); setConflict(null); }}>
              <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>
                {activeServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.duration_minutes}min — ${s.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={appointmentDate}
              onChange={(e) => { setAppointmentDate(e.target.value); setAppointmentTime(""); setTimeInputDisplay(""); setTimeError(null); setConflict(null); }}
            />
            {serviceId && !coverageOnDate && (
              <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-2">
                <p className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  No appointments available on {format(dateObj, "EEEE, MMMM d")}.
                </p>
                {nextAvailable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => {
                      setAppointmentDate(format(nextAvailable.date, "yyyy-MM-dd"));
                      setAppointmentTime(nextAvailable.time);
                      setTimeInputDisplay(formatTime12h(nextAvailable.time));
                    }}
                  >
                    <span>
                      Next available: {format(nextAvailable.date, "EEE, MMM d")} at {formatTime12h(nextAvailable.time)}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No availability found in the next 60 days. Assign a therapist + room manually below to override.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Time */}
          <div>
            <Label>Time *</Label>
            {serviceId && appointmentDate ? (
              <div className="space-y-1.5">
                <Input
                  placeholder="e.g. 10:00 AM or 2:30 PM"
                  value={timeInputDisplay}
                  onChange={(e) => { setTimeInputDisplay(e.target.value); setTimeError(null); }}
                  onBlur={handleTimeInputBlur}
                  onKeyDown={handleTimeKeyDown}
                  error={!!timeError}
                />
                {timeError && (
                  <p className="text-xs text-destructive">{timeError}</p>
                )}
                {windowHint && (
                  <p className="text-xs text-muted-foreground">
                    Available: {formatTime12h(windowHint.start)} – {formatTime12h(windowHint.end)} (last booking {formatTime12h(windowHint.latestStart)})
                  </p>
                )}
                {selectedService && (
                  <p className="text-xs text-muted-foreground">
                    Duration: {selectedService.duration_minutes}min + {selectedService.cleanup_minutes}min cleanup
                  </p>
                )}
                {selectedService && totalPossibleStartTimes > 0 && availableStartTimes.length < totalPossibleStartTimes && (
                  <p className="text-xs text-destructive/80">
                    {totalPossibleStartTimes - availableStartTimes.length} slot
                    {totalPossibleStartTimes - availableStartTimes.length === 1 ? "" : "s"} already booked on this date
                    {therapistId !== "auto" || roomId !== "auto" ? " for this therapist/room" : ""}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a service and date first</p>
            )}
          </div>

          {conflict && (
            <div className="flex items-center gap-2 p-3 border border-destructive/30 bg-destructive/5 rounded-md">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{conflict}</p>
            </div>
          )}

          {/* Therapist */}
          <div>
            <Label>Therapist</Label>
            <Select value={therapistId} onValueChange={setTherapistId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-assign</SelectItem>
                {activeTherapists.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {therapistId === "auto" && resolvedTherapistId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-assigned therapist: {activeTherapists.find((t) => t.id === resolvedTherapistId)?.full_name || "Assigned"}
              </p>
            )}
          </div>

          {/* Room */}
          <div>
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-assign</SelectItem>
                {activeRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roomId === "auto" && resolvedRoomId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-assigned room: {activeRooms.find((r) => r.id === resolvedRoomId)?.name || "Assigned"}
              </p>
            )}
          </div>

          {/* Payment */}
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In Person</SelectItem>
                <SelectItem value="member_account">Member Account</SelectItem>
                <SelectItem value="card">Card on File</SelectItem>
                <SelectItem value="comp">Complimentary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label>Staff Notes</Label>
            <Textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => bookMutation.mutate()}
            disabled={!serviceId || !appointmentTime || !appointmentDate || bookMutation.isPending || !!conflict || !!timeError || (!!selectedMemberId && !selectedMemberWaiverSigned)}
          >
            {bookMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Book Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
