import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Info, DollarSign } from "lucide-react";
import { useSpaServices, useSpaTherapists, useSpaRooms, useSpaServiceAvailability } from "@/hooks/useSpaManagement";
import { useCheckSpaAvailability } from "@/hooks/useSpaBooking";
import { format } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
import { parseTimeInput } from "@/lib/parseTimeInput";
import {
  findCoveringSlot,
  hasCoverageOnDate,
  getServiceWindowForDate,
  latestStartTime,
} from "@/lib/spaAvailability";
import { AdminSpaAppointment, useUpdateSpaAppointment } from "@/hooks/useAdminSpaAppointments";

interface Props {
  appointment: AdminSpaAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpaAppointmentEditModal({ appointment, open, onOpenChange }: Props) {
  const { data: services } = useSpaServices();
  const { data: therapists } = useSpaTherapists();
  const { data: rooms } = useSpaRooms();
  const { data: availability } = useSpaServiceAvailability();
  const updateAppt = useUpdateSpaAppointment();
  const checkAvail = useCheckSpaAvailability();

  const [serviceId, setServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState(""); // HH:mm
  const [timeInputDisplay, setTimeInputDisplay] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState<string>("auto");
  const [roomId, setRoomId] = useState<string>("auto");
  const [staffNotes, setStaffNotes] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const [resolvedTherapistId, setResolvedTherapistId] = useState<string | null>(null);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(null);

  // Pre-populate when appointment changes
  useEffect(() => {
    if (!appointment) return;
    const t = (appointment.appointment_time || "").slice(0, 5);
    setServiceId(appointment.service_id || "");
    setAppointmentDate(appointment.appointment_date);
    setAppointmentTime(t);
    setTimeInputDisplay(t ? formatTime12h(t) : "");
    setTimeError(null);
    setTherapistId(appointment.staff_id || "auto");
    setRoomId(appointment.room_id || "auto");
    setStaffNotes((appointment as any).staff_notes || "");
    setConflict(null);
    setResolvedTherapistId(null);
    setResolvedRoomId(null);
  }, [appointment?.id]);

  const activeServices = useMemo(() => (services || []).filter((s) => s.is_active), [services]);
  const activeTherapists = useMemo(() => (therapists || []).filter((t) => t.is_active), [therapists]);
  const activeRooms = useMemo(() => (rooms || []).filter((r) => r.is_active), [rooms]);

  const selectedService = useMemo(
    () => services?.find((s) => s.id === serviceId),
    [services, serviceId]
  );

  const dateObj = useMemo(
    () => (appointmentDate ? new Date(appointmentDate + "T12:00:00") : new Date()),
    [appointmentDate]
  );

  const coverageOnDate = useMemo(() => {
    if (!serviceId || !appointmentDate) return false;
    return hasCoverageOnDate(availability, serviceId, dateObj);
  }, [availability, serviceId, dateObj, appointmentDate]);

  const windowHint = useMemo(() => {
    if (!selectedService || !appointmentDate) return null;
    const w = getServiceWindowForDate(availability, serviceId, dateObj);
    if (!w) return null;
    const last = latestStartTime(w.end, selectedService.duration_minutes, selectedService.cleanup_minutes);
    return { start: w.start, end: w.end, latestStart: last };
  }, [availability, selectedService, serviceId, dateObj, appointmentDate]);

  const runConflictCheck = useCallback(
    async (time: string) => {
      setConflict(null);
      setResolvedTherapistId(null);
      setResolvedRoomId(null);
      if (!selectedService || !appointment) return;

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
        setConflict("Please assign a therapist or room.");
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
          excludeAppointmentId: appointment.id,
        });
        if (!result.available) {
          const types = new Set(result.conflictingAppointments.map((c: any) => c._conflictType));
          if (types.has("staff") && types.has("room")) {
            setConflict("Both the therapist and treatment room are already booked at this time.");
          } else if (types.has("room")) {
            setConflict("This treatment room is already booked at that time.");
          } else {
            setConflict("This therapist already has a booking at this time.");
          }
        }
      } catch {
        // fail-soft
      }
    },
    [selectedService, dateObj, availability, serviceId, therapistId, roomId, checkAvail, appointment]
  );

  // Re-run check when fields change
  useEffect(() => {
    if (appointmentTime) void runConflictCheck(appointmentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId, roomId, appointmentDate, serviceId]);

  const handleTimeBlur = () => {
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

  if (!appointment) return null;

  const wasPaid = !!(appointment as any).payment_intent_id || !!(appointment as any).amount_paid;
  const priceChanged =
    !!selectedService &&
    (selectedService.price !== appointment.service_price ||
      (selectedService.member_price ?? null) !== (appointment.member_price ?? null));

  const handleSave = async () => {
    if (!selectedService || !appointmentTime || !appointmentDate) return;
    if (conflict) return;

    const resolvedTherapist = therapistId !== "auto" ? therapistId : resolvedTherapistId || null;
    const resolvedRoom = roomId !== "auto" ? roomId : resolvedRoomId || null;

    if (!resolvedTherapist && !resolvedRoom) {
      setConflict("Please assign a therapist or room.");
      return;
    }

    // Final server-side check excluding self
    const result = await checkAvail.mutateAsync({
      appointmentDate: dateObj,
      appointmentTime,
      durationMinutes: selectedService.duration_minutes,
      cleanupMinutes: selectedService.cleanup_minutes,
      staffId: resolvedTherapist || undefined,
      roomId: resolvedRoom || undefined,
      excludeAppointmentId: appointment.id,
    });
    if (!result.available) {
      setConflict("That therapist or room is already booked for the full service plus cleanup time.");
      return;
    }

    await updateAppt.mutateAsync({
      appointmentId: appointment.id,
      service_id: selectedService.id,
      service_name: selectedService.name,
      service_category: selectedService.category,
      service_price: selectedService.price,
      member_price: selectedService.member_price ?? null,
      duration_minutes: selectedService.duration_minutes,
      cleanup_minutes: selectedService.cleanup_minutes,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime + ":00",
      staff_id: resolvedTherapist,
      room_id: resolvedRoom,
      staff_notes: staffNotes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service */}
          <div>
            <Label>Service *</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
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
              onChange={(e) => {
                setAppointmentDate(e.target.value);
                setConflict(null);
              }}
            />
            {serviceId && appointmentDate && !coverageOnDate && (
              <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                No standard availability on {format(dateObj, "EEEE, MMMM d")}. Assign therapist + room manually to override.
              </p>
            )}
          </div>

          {/* Time */}
          <div>
            <Label>Time *</Label>
            <Input
              placeholder="e.g. 10:00 AM or 2:30 PM"
              value={timeInputDisplay}
              onChange={(e) => { setTimeInputDisplay(e.target.value); setTimeError(null); }}
              onBlur={handleTimeBlur}
              onKeyDown={handleTimeKeyDown}
              error={!!timeError}
            />
            {timeError && <p className="mt-1 text-xs text-destructive">{timeError}</p>}
            {windowHint && (
              <p className="mt-1 text-xs text-muted-foreground">
                Available: {formatTime12h(windowHint.start)} – {formatTime12h(windowHint.end)} (last booking {formatTime12h(windowHint.latestStart)})
              </p>
            )}
            {selectedService && (
              <p className="mt-1 text-xs text-muted-foreground">
                Duration: {selectedService.duration_minutes}min + {selectedService.cleanup_minutes}min cleanup
              </p>
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
                Auto-assigned: {activeTherapists.find((t) => t.id === resolvedTherapistId)?.full_name || "Assigned"}
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
                Auto-assigned: {activeRooms.find((r) => r.id === resolvedRoomId)?.name || "Assigned"}
              </p>
            )}
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

          {priceChanged && (
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertTitle>Pricing changed</AlertTitle>
              <AlertDescription>
                New service price is ${selectedService?.price.toFixed(2)} (was ${appointment.service_price?.toFixed(2)}).
                {wasPaid
                  ? " This appointment was already paid — collect or refund the difference at checkout."
                  : " Charge the new amount at checkout."}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={
              !serviceId ||
              !appointmentTime ||
              !appointmentDate ||
              !!conflict ||
              !!timeError ||
              updateAppt.isPending ||
              checkAvail.isPending
            }
          >
            {(updateAppt.isPending || checkAvail.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
