import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Search, FileCheck } from "lucide-react";
import { useSpaServices, useSpaTherapists, useSpaRooms, useSpaServiceAvailability } from "@/hooks/useSpaManagement";
import { useCheckSpaAvailability } from "@/hooks/useSpaBooking";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parse, getDay } from "date-fns";

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

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [appointmentTime, setAppointmentTime] = useState("");
  const [therapistId, setTherapistId] = useState<string>("auto");
  const [roomId, setRoomId] = useState<string>("auto");
  const [staffNotes, setStaffNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("in_person");
  const [conflict, setConflict] = useState<string | null>(null);

  // Search members
  const { data: memberResults } = useQuery({
    queryKey: ["member-search-spa", memberSearch],
    queryFn: async () => {
      if (memberSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, membership_type, user_id")
        .or(`first_name.ilike.%${memberSearch}%,last_name.ilike.%${memberSearch}%,email.ilike.%${memberSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: memberSearch.length >= 2,
  });

  // Track selected member's waiver status
  const [selectedMemberWaiverSigned, setSelectedMemberWaiverSigned] = useState(false);

  // Check waiver status when member is selected
  const checkMemberWaiver = async (userId: string | null) => {
    if (!userId) {
      setSelectedMemberWaiverSigned(false);
      return;
    }
    // Check profiles table
    const { data: profileData } = await supabase
      .from("profiles")
      .select("waiver_signed")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileData?.waiver_signed) {
      setSelectedMemberWaiverSigned(true);
      return;
    }
    // Check non_member_profiles table
    const { data: nonMemberData } = await supabase
      .from("non_member_profiles")
      .select("waiver_signed")
      .eq("user_id", userId)
      .maybeSingle();
    setSelectedMemberWaiverSigned(nonMemberData?.waiver_signed === true);
  };

  const selectedService = useMemo(() => 
    services?.find(s => s.id === serviceId), [services, serviceId]
  );

  // Determine available time slots based on availability config
  const availableSlots = useMemo(() => {
    if (!serviceId || !appointmentDate || !availability) return [];
    const dayOfWeek = getDay(new Date(appointmentDate + "T12:00:00"));
    const serviceSlots = availability.filter(
      a => a.service_id === serviceId && a.day_of_week === dayOfWeek && a.is_active
    );
    // Generate 30-min intervals from each availability window
    const slots: { time: string; therapistId: string | null; roomId: string | null }[] = [];
    for (const slot of serviceSlots) {
      const start = parse(slot.start_time, "HH:mm:ss", new Date());
      const end = parse(slot.end_time, "HH:mm:ss", new Date());
      const duration = selectedService?.duration_minutes || 60;
      let current = start;
      while (current < end) {
        const timeStr = format(current, "HH:mm");
        // Check if there's enough time for the service
        const serviceEnd = new Date(current.getTime() + duration * 60000);
        if (serviceEnd <= end) {
          slots.push({ time: timeStr, therapistId: slot.therapist_id, roomId: slot.room_id });
        }
        current = new Date(current.getTime() + 30 * 60000);
      }
    }
    // Deduplicate by time
    const unique = new Map<string, typeof slots[0]>();
    for (const s of slots) {
      if (!unique.has(s.time)) unique.set(s.time, s);
    }
    return Array.from(unique.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [serviceId, appointmentDate, availability, selectedService]);

  // Check for conflicts when time changes
  const checkAvail = useCheckSpaAvailability();

  const handleTimeSelect = async (time: string) => {
    setAppointmentTime(time);
    setConflict(null);
    if (!selectedService) return;

    // Find availability slot for this time to auto-assign therapist/room
    const dayOfWeek = getDay(new Date(appointmentDate + "T12:00:00"));
    const matchingSlot = availability?.find(a => {
      if (a.service_id !== serviceId || a.day_of_week !== dayOfWeek || !a.is_active) return false;
      const start = parse(a.start_time, "HH:mm:ss", new Date());
      const end = parse(a.end_time, "HH:mm:ss", new Date());
      const t = parse(time, "HH:mm", new Date());
      return t >= start && t < end;
    });

    if (matchingSlot) {
      if (therapistId === "auto" && matchingSlot.therapist_id) {
        setTherapistId(matchingSlot.therapist_id);
      }
      if (roomId === "auto" && matchingSlot.room_id) {
        setRoomId(matchingSlot.room_id);
      }
    }

    // Check existing appointments for conflicts
    const resolvedTherapist = therapistId !== "auto" ? therapistId : matchingSlot?.therapist_id;
    if (resolvedTherapist) {
      try {
        const result = await checkAvail.mutateAsync({
          appointmentDate: new Date(appointmentDate),
          appointmentTime: time,
          durationMinutes: selectedService.duration_minutes + selectedService.cleanup_minutes,
          staffId: resolvedTherapist,
        });
        if (!result.available) {
          setConflict("This therapist already has a booking at this time. Choose a different time or therapist.");
        }
      } catch {
        // ignore
      }
    }
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService || !appointmentTime) throw new Error("Missing required fields");
      
      const resolvedTherapist = therapistId !== "auto" ? therapistId : null;
      const resolvedRoom = roomId !== "auto" ? roomId : null;

      const { error } = await (supabase.from as any)("spa_appointments").insert({
        member_id: selectedMemberId,
        user_id: null,
        service_id: parseInt(selectedService.id),
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
        staff_notes: staffNotes || null,
        payment_method: paymentMethod,
        amount_paid: selectedService.member_price || selectedService.price,
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
    setTherapistId("auto");
    setRoomId("auto");
    setStaffNotes("");
    setPaymentMethod("in_person");
    setConflict(null);
  };

  const activeServices = services?.filter(s => s.is_active) || [];
  const activeTherapists = therapists?.filter(t => t.is_active) || [];
  const activeRooms = rooms?.filter(r => r.is_active) || [];

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
                  onChange={e => setMemberSearch(e.target.value)}
                />
                {memberResults && memberResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {memberResults.map(m => (
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

          {/* Service */}
          <div>
            <Label>Service *</Label>
            <Select value={serviceId} onValueChange={v => { setServiceId(v); setAppointmentTime(""); setConflict(null); }}>
              <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>
                {activeServices.map(s => (
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
              onChange={e => { setAppointmentDate(e.target.value); setAppointmentTime(""); setConflict(null); }}
            />
          </div>

          {/* Time */}
          <div>
            <Label>Time *</Label>
            {availableSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {availableSlots.map(slot => (
                  <Button
                    key={slot.time}
                    size="sm"
                    variant={appointmentTime === slot.time ? "default" : "outline"}
                    onClick={() => handleTimeSelect(slot.time)}
                    className="text-xs"
                  >
                    {slot.time}
                  </Button>
                ))}
              </div>
            ) : serviceId && appointmentDate ? (
              <div className="text-sm text-muted-foreground p-2 border rounded-md bg-secondary/30">
                No availability configured for this service on this day. 
                <Input 
                  type="time" 
                  className="mt-2" 
                  value={appointmentTime} 
                  onChange={e => handleTimeSelect(e.target.value)} 
                  placeholder="Enter time manually"
                />
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
                {activeTherapists.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room */}
          <div>
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-assign</SelectItem>
                {activeRooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              onChange={e => setStaffNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => bookMutation.mutate()} 
            disabled={!serviceId || !appointmentTime || !appointmentDate || bookMutation.isPending || !!conflict}
          >
            {bookMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Book Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
