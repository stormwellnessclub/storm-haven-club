import { useState, useMemo } from "react";
import {
  useSpaServices, useSpaTherapists, useSpaRooms,
  useSpaServiceAvailability, useCreateSpaAvailability, useUpdateSpaAvailability, useDeleteSpaAvailability,
  type SpaServiceAvailability,
} from "@/hooks/useSpaManagement";
import { useAdminSpaAppointments, AdminSpaAppointment } from "@/hooks/useAdminSpaAppointments";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Trash2, AlertTriangle, CalendarDays, CheckCircle2, CreditCard, ClipboardCheck } from "lucide-react";
import { SpaCompletionDialog } from "./SpaCompletionDialog";
import { format, parse } from "date-fns";
import { formatSpaTime, formatSpaTimeRange } from "@/lib/spaTime";
import { parseTimeInput } from "@/lib/parseTimeInput";
import { formatTime12h } from "@/lib/timeFormat";
import { useIntakeFormStatuses } from "@/hooks/useSpaIntake";
import { IntakeFormViewDialog } from "@/components/spa/IntakeFormViewDialog";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function TimeTextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value ? formatTime12h(value) : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Input
        type="text"
        placeholder="e.g. 10:00 AM"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onBlur={() => {
          if (!text.trim()) return;
          const parsed = parseTimeInput(text);
          if (parsed) {
            onChange(parsed);
            setText(formatTime12h(parsed));
            setError(null);
          } else {
            setError("Invalid time");
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const emptySlot = (): Omit<SpaServiceAvailability, "id"> => ({
  service_id: "", therapist_id: null, room_id: null,
  day_of_week: 1, start_time: "09:00", end_time: "17:00",
  max_bookings: 1, is_active: true, specific_date: null,
});

/** Day-of-week for a "yyyy-MM-dd" string, computed at local noon to avoid TZ drift. */
const dowForDate = (iso: string) => new Date(iso + "T12:00:00").getDay();

const formatOneOffDate = (iso: string) => format(new Date(iso + "T12:00:00"), "EEE MMM d");


interface SpaAvailabilityTabProps {
  initialView?: string;
  initialDate?: string;
}

export function SpaAvailabilityTab({ initialView, initialDate }: SpaAvailabilityTabProps) {
  const { data: services } = useSpaServices();
  const { data: therapists } = useSpaTherapists();
  const { data: rooms } = useSpaRooms();
  const { data: availability, isLoading } = useSpaServiceAvailability();
  const createAvail = useCreateSpaAvailability();
  const updateAvail = useUpdateSpaAvailability();
  const deleteAvail = useDeleteSpaAvailability();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySlot());
  const [filterService, setFilterService] = useState("all");
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [slotMode, setSlotMode] = useState<"recurring" | "oneoff">("recurring");
  const [oneOffDate, setOneOffDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [conflicts, setConflicts] = useState<string[]>([]);

  const [subTab, setSubTab] = useState(initialView === "schedule" ? "schedule" : "slots");
  const [scheduleDate, setScheduleDate] = useState(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [completionAppointment, setCompletionAppointment] = useState<AdminSpaAppointment | null>(null);
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [intakeViewAppointment, setIntakeViewAppointment] = useState<AdminSpaAppointment | null>(null);

  // Fetch appointments for schedule view
  const { data: dayAppointments } = useAdminSpaAppointments({
    appointmentDate: new Date(scheduleDate + "T12:00:00"),
  });

  // Bulk-load intake form submission status so we can show a per-appointment badge.
  const appointmentIds = useMemo(
    () => (dayAppointments || []).map((a) => a.id),
    [dayAppointments]
  );
  const { data: intakeStatuses } = useIntakeFormStatuses(appointmentIds);

  const openNew = () => { 
    setForm(emptySlot()); 
    setEditingId(null); 
    setSelectedDays([1]); 
    setSlotMode("recurring");
    setOneOffDate(format(new Date(), "yyyy-MM-dd"));
    setConflicts([]); 
    setShowForm(true); 
  };
  
  const openEdit = (slot: SpaServiceAvailability) => {
    setForm({
      service_id: slot.service_id, therapist_id: slot.therapist_id, room_id: slot.room_id,
      day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time,
      max_bookings: slot.max_bookings, is_active: slot.is_active,
      specific_date: slot.specific_date ?? null,
    });
    setEditingId(slot.id);
    setSelectedDays([slot.day_of_week]);
    setSlotMode(slot.specific_date ? "oneoff" : "recurring");
    setOneOffDate(slot.specific_date || format(new Date(), "yyyy-MM-dd"));
    setConflicts([]);
    setShowForm(true);
  };

  // Conflict detection.
  // `targets` are either weekdays (recurring) or a single ISO date (one-off).
  const checkConflicts = (
    targets: { day: number; date: string | null }[],
    formData: typeof form
  ) => {
    if (!availability) return [];
    const found: string[] = [];
    for (const target of targets) {
      const overlapping = availability.filter(a => {
        if (editingId && a.id === editingId) return false;
        // Date matching: a one-off slot only clashes on its own date; a recurring
        // slot clashes on every matching weekday (including one-off dates on it).
        if (a.specific_date) {
          if (target.date ? a.specific_date !== target.date : a.day_of_week !== target.day) return false;
        } else if (a.day_of_week !== target.day) {
          return false;
        }
        // Check therapist overlap
        const therapistMatch = formData.therapist_id && a.therapist_id && a.therapist_id === formData.therapist_id;
        // Check room overlap  
        const roomMatch = formData.room_id && a.room_id && a.room_id === formData.room_id;
        if (!therapistMatch && !roomMatch) return false;
        // Check time overlap
        const aStart = a.start_time.slice(0, 5);
        const aEnd = a.end_time.slice(0, 5);
        const fStart = formData.start_time.slice(0, 5);
        const fEnd = formData.end_time.slice(0, 5);
        return fStart < aEnd && fEnd > aStart;
      });
      for (const o of overlapping) {
        const resource = o.therapist_id === formData.therapist_id
          ? getTherapistName(o.therapist_id)
          : getRoomName(o.room_id);
        const svcName = getServiceName(o.service_id);
        const label = target.date ? formatOneOffDate(target.date) : DAYS[target.day];
        found.push(`${label}: ${resource} already assigned to "${svcName}" ${formatSpaTimeRange(o.start_time, o.end_time)}`);
      }
    }
    return found;
  };

  const handleSave = () => {
    const isOneOff = slotMode === "oneoff";
    const targets = isOneOff
      ? [{ day: dowForDate(oneOffDate), date: oneOffDate }]
      : (editingId ? [form.day_of_week] : selectedDays).map(d => ({ day: d, date: null }));
    setConflicts(checkConflicts(targets, form));

    if (editingId) {
      const payload = isOneOff
        ? { ...form, specific_date: oneOffDate, day_of_week: dowForDate(oneOffDate) }
        : { ...form, specific_date: null };
      updateAvail.mutate({ id: editingId, ...payload }, { onSuccess: () => setShowForm(false) });
    } else if (isOneOff) {
      createAvail.mutate(
        { ...form, specific_date: oneOffDate, day_of_week: dowForDate(oneOffDate) },
        { onSuccess: () => setShowForm(false) }
      );
    } else {
      // Bulk create for all selected days
      const daysToCreate = selectedDays.length > 0 ? selectedDays : [form.day_of_week];
      let completed = 0;
      for (const day of daysToCreate) {
        createAvail.mutate(
          { ...form, day_of_week: day, specific_date: null },
          { onSuccess: () => { completed++; if (completed === daysToCreate.length) setShowForm(false); } }
        );
      }
    }
  };


  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getServiceName = (id: string) => services?.find(s => s.id === id)?.name || "Unknown";
  const getTherapistName = (id: string | null) => id ? therapists?.find(t => t.id === id)?.full_name || "Unknown" : "Any";
  const getRoomName = (id: string | null) => id ? rooms?.find(r => r.id === id)?.name || "Unknown" : "Any";

  const filtered = filterService === "all"
    ? availability
    : availability?.filter(a => a.service_id === filterService);

  const grouped = (filtered || []).reduce((acc, slot) => {
    const name = getServiceName(slot.service_id);
    (acc[name] = acc[name] || []).push(slot);
    return acc;
  }, {} as Record<string, SpaServiceAvailability[]>);

  // Schedule view: group availability by therapist for the selected date's day of week
  const scheduleDayOfWeek = new Date(scheduleDate + "T12:00:00").getDay();
  const therapistSchedule = useMemo(() => {
    if (!availability || !therapists) return { assigned: [], unassigned: [], needsAttention: [] };
    const activeTherapists = therapists.filter(t => t.is_active);
    const surfacedIds = new Set<string>();
    const assigned = activeTherapists.map(t => {
      const slots = (availability || []).filter(
        a =>
          a.therapist_id === t.id &&
          a.is_active &&
          (a.specific_date ? a.specific_date === scheduleDate : a.day_of_week === scheduleDayOfWeek)
      );

      const booked = (dayAppointments || []).filter(
        a => a.staff_id === t.id && !["cancelled", "no_show"].includes(a.status)
      );
      booked.forEach(b => surfacedIds.add(b.id));
      return { therapist: t, slots, booked };
    });
    const unassigned = (dayAppointments || []).filter(
      a => !a.staff_id && !["cancelled", "no_show"].includes(a.status)
    );
    unassigned.forEach(u => surfacedIds.add(u.id));
    // Catch-all: any non-cancelled appointment not already surfaced
    const needsAttention = (dayAppointments || []).filter(
      a => !surfacedIds.has(a.id) && !["cancelled", "no_show"].includes(a.status)
    );
    return { assigned, unassigned, needsAttention };
  }, [availability, therapists, scheduleDayOfWeek, scheduleDate, dayAppointments]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <TabsList>
            <TabsTrigger value="slots">Availability Slots</TabsTrigger>
            <TabsTrigger value="schedule">Therapist Schedule</TabsTrigger>
          </TabsList>
          {subTab === "slots" && (
            <div className="flex gap-3 items-center">
              <Select value={filterService} onValueChange={setFilterService}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="Filter by service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {services?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Slot</Button>
            </div>
          )}
        </div>

        <TabsContent value="slots" className="space-y-4 mt-4">
          {Object.keys(grouped).length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No availability slots configured. Add a slot to define when services are available.
            </CardContent></Card>
          )}

          {Object.entries(grouped).sort().map(([serviceName, slots]) => (
            <Card key={serviceName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{serviceName}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {slots.map(slot => (
                    <div key={slot.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Badge variant={slot.is_active ? "default" : "outline"} className="text-xs w-20 justify-center">
                        {DAYS[slot.day_of_week]?.slice(0, 3)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatSpaTimeRange(slot.start_time, slot.end_time)}
                      </span>
                      <span className="text-xs">👤 {getTherapistName(slot.therapist_id)}</span>
                      <span className="text-xs">🚪 {getRoomName(slot.room_id)}</span>
                      <span className="text-xs text-muted-foreground ml-auto">max {slot.max_bookings}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(slot)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAvail.mutate(slot.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input 
              type="date" 
              value={scheduleDate} 
              onChange={e => setScheduleDate(e.target.value)}
              className="w-auto"
            />
            <span className="text-sm text-muted-foreground">
              {DAYS[scheduleDayOfWeek]}
            </span>
          </div>

          {therapistSchedule.assigned.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No active therapists found.
            </CardContent></Card>
          ) : (
            <>
              {therapistSchedule.assigned.map(({ therapist, slots, booked }) => (
                <Card key={therapist.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      👤 {therapist.full_name}
                      {slots.length === 0 && booked.length === 0 && <Badge variant="outline" className="text-xs">No availability or bookings</Badge>}
                    </CardTitle>
                  </CardHeader>
                  {(slots.length > 0 || booked.length > 0) && (
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {slots.map(slot => (
                          <div key={slot.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                            <Badge variant="outline" className="text-xs bg-secondary/50">
                              {formatSpaTimeRange(slot.start_time, slot.end_time)}
                            </Badge>
                            <span className="text-xs">{getServiceName(slot.service_id)}</span>
                            <span className="text-xs text-muted-foreground">🚪 {getRoomName(slot.room_id)}</span>
                          </div>
                        ))}
                        {booked.length > 0 && (
                          <div className="px-4 py-1.5 bg-primary/5 border-t">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booked Appointments ({booked.length})</span>
                          </div>
                        )}
                        {booked.map(apt => {
                          const timeStr = formatSpaTime(apt.appointment_time);
                          const isActionable = ['confirmed'].includes(apt.status);
                          const needsCharge = apt.status === 'completed' && (!apt.amount_paid || apt.amount_paid === 0);
                          return (
                            <div
                              key={apt.id}
                              className={`flex items-center gap-3 px-4 py-2 text-sm bg-primary/5 ${
                                (isActionable || needsCharge) ? 'cursor-pointer hover:bg-primary/10 transition-colors' : ''
                              }`}
                              onClick={() => {
                                if (isActionable) { setCompletionAppointment(apt); setIsRetroactive(false); }
                                else if (needsCharge) { setCompletionAppointment(apt); setIsRetroactive(true); }
                              }}
                            >
                              <Badge className="text-xs">{timeStr}</Badge>
                              <span className="text-xs font-medium">
                                {apt.customer ? (`${apt.customer.first_name} ${apt.customer.last_name}`.trim() || apt.customer.email || "Name unavailable") : (apt.member ? `${apt.member.first_name} ${apt.member.last_name}` : "Name unavailable")}
                                {apt.customer?.type === "non_member" && <span className="ml-1 text-muted-foreground">(Non-Member)</span>}
                              </span>
                              <span className="text-xs">{apt.service_name}</span>
                              {intakeStatuses?.[apt.id] && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80"
                                  onClick={(e) => { e.stopPropagation(); setIntakeViewAppointment(apt); }}
                                  title="View intake form"
                                >
                                  <ClipboardCheck className="h-3 w-3" />Intake
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs ml-auto">{apt.status}</Badge>
                              {apt.bookedBy && (
                                <span className="text-[10px] text-muted-foreground italic" title={`Booked by: ${apt.bookedBy.name}`}>
                                  · {apt.bookedBy.role === "self" ? "self-booked" : apt.bookedBy.role === "admin" ? `by ${apt.bookedBy.name}` : apt.bookedBy.role === "walk_in" ? "walk-in" : ""}
                                </span>
                              )}
                              {isActionable && (
                                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setCompletionAppointment(apt); setIsRetroactive(false); }}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Complete
                                </Button>
                              )}
                              {needsCharge && (
                                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setCompletionAppointment(apt); setIsRetroactive(true); }}>
                                  <CreditCard className="h-3 w-3 mr-1" />Charge
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}

              {therapistSchedule.unassigned.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      📋 Unassigned Appointments
                      <Badge variant="outline" className="text-xs">{therapistSchedule.unassigned.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {therapistSchedule.unassigned.map(apt => {
                        const timeStr = formatSpaTime(apt.appointment_time);
                        const isActionable = ['confirmed'].includes(apt.status);
                        const needsCharge = apt.status === 'completed' && (!apt.amount_paid || apt.amount_paid === 0);
                        return (
                          <div
                            key={apt.id}
                            className={`flex items-center gap-3 px-4 py-2 text-sm bg-primary/5 ${
                              (isActionable || needsCharge) ? 'cursor-pointer hover:bg-primary/10 transition-colors' : ''
                            }`}
                            onClick={() => {
                              if (isActionable) { setCompletionAppointment(apt); setIsRetroactive(false); }
                              else if (needsCharge) { setCompletionAppointment(apt); setIsRetroactive(true); }
                            }}
                          >
                            <Badge className="text-xs">{timeStr}</Badge>
                            <span className="text-xs font-medium">
                              {apt.customer ? (`${apt.customer.first_name} ${apt.customer.last_name}`.trim() || apt.customer.email || "Name unavailable") : (apt.member ? `${apt.member.first_name} ${apt.member.last_name}` : "Name unavailable")}
                              {apt.customer?.type === "non_member" && <span className="ml-1 text-muted-foreground">(Non-Member)</span>}
                            </span>
                            <span className="text-xs">{apt.service_name}</span>
                            {intakeStatuses?.[apt.id] && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80"
                                onClick={(e) => { e.stopPropagation(); setIntakeViewAppointment(apt); }}
                                title="View intake form"
                              >
                                <ClipboardCheck className="h-3 w-3" />Intake
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs ml-auto">{apt.status}</Badge>
                            {apt.bookedBy && (
                              <span className="text-[10px] text-muted-foreground italic" title={`Booked by: ${apt.bookedBy.name}`}>
                                · {apt.bookedBy.role === "self" ? "self-booked" : apt.bookedBy.role === "admin" ? `by ${apt.bookedBy.name}` : apt.bookedBy.role === "walk_in" ? "walk-in" : ""}
                              </span>
                            )}
                            {isActionable && (
                              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setCompletionAppointment(apt); setIsRetroactive(false); }}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />Complete
                              </Button>
                            )}
                            {needsCharge && (
                              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setCompletionAppointment(apt); setIsRetroactive(true); }}>
                                <CreditCard className="h-3 w-3 mr-1" />Charge
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {therapistSchedule.needsAttention.length > 0 && (
                <Card className="border-amber-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Needs Attention
                      <Badge variant="outline" className="text-xs">{therapistSchedule.needsAttention.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {therapistSchedule.needsAttention.map(apt => {
                        const timeStr = formatSpaTime(apt.appointment_time);
                        const isActionable = ['confirmed'].includes(apt.status);
                        const needsCharge = apt.status === 'completed' && (!apt.amount_paid || apt.amount_paid === 0);
                        return (
                          <div
                            key={apt.id}
                            className={`flex items-center gap-3 px-4 py-2 text-sm bg-amber-500/5 ${
                              (isActionable || needsCharge) ? 'cursor-pointer hover:bg-amber-500/10 transition-colors' : ''
                            }`}
                            onClick={() => {
                              if (isActionable) { setCompletionAppointment(apt); setIsRetroactive(false); }
                              else if (needsCharge) { setCompletionAppointment(apt); setIsRetroactive(true); }
                            }}
                          >
                            <Badge className="text-xs">{timeStr}</Badge>
                            <span className="text-xs font-medium">
                              {apt.customer ? (`${apt.customer.first_name} ${apt.customer.last_name}`.trim() || apt.customer.email || "Name unavailable") : (apt.member ? `${apt.member.first_name} ${apt.member.last_name}` : "Name unavailable")}
                              {apt.customer?.type === "non_member" && <span className="ml-1 text-muted-foreground">(Non-Member)</span>}
                            </span>
                            <span className="text-xs">{apt.service_name}</span>
                            {intakeStatuses?.[apt.id] && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80"
                                onClick={(e) => { e.stopPropagation(); setIntakeViewAppointment(apt); }}
                                title="View intake form"
                              >
                                <ClipboardCheck className="h-3 w-3" />Intake
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs ml-auto">{apt.status}</Badge>
                            {apt.bookedBy && (
                              <span className="text-[10px] text-muted-foreground italic" title={`Booked by: ${apt.bookedBy.name}`}>
                                · {apt.bookedBy.role === "self" ? "self-booked" : apt.bookedBy.role === "admin" ? `by ${apt.bookedBy.name}` : apt.bookedBy.role === "walk_in" ? "walk-in" : ""}
                              </span>
                            )}
                            {isActionable && (
                              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setCompletionAppointment(apt); setIsRetroactive(false); }}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />Complete
                              </Button>
                            )}
                            {needsCharge && (
                              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setCompletionAppointment(apt); setIsRetroactive(true); }}>
                                <CreditCard className="h-3 w-3 mr-1" />Charge
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Slot Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Availability Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Service *</Label>
              <Select value={form.service_id} onValueChange={v => setForm({ ...form, service_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Day selection - bulk for new, single for edit */}
            {editingId ? (
              <div>
                <Label>Day of Week</Label>
                <Select value={String(form.day_of_week)} onValueChange={v => setForm({ ...form, day_of_week: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Days of Week (select multiple)</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map((d, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={selectedDays.includes(i) ? "default" : "outline"}
                      onClick={() => toggleDay(i)}
                      className="text-xs"
                    >
                      {d.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <TimeTextInput value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
              </div>
              <div>
                <Label>End Time</Label>
                <TimeTextInput value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} />
              </div>
            </div>
            <div>
              <Label>Therapist</Label>
              <Select value={form.therapist_id || "any"} onValueChange={v => setForm({ ...form, therapist_id: v === "any" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Available</SelectItem>
                  {therapists?.filter(t => t.is_active).map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room</Label>
              <Select value={form.room_id || "any"} onValueChange={v => setForm({ ...form, room_id: v === "any" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Available</SelectItem>
                  {rooms?.filter(r => r.is_active).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Bookings per Slot</Label>
              <Input type="number" min={1} value={form.max_bookings} onChange={e => setForm({ ...form, max_bookings: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>

            {/* Conflict warnings */}
            {conflicts.length > 0 && (
              <div className="p-3 border border-amber-500/30 bg-amber-500/5 rounded-md space-y-1">
                <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Resource Conflicts Detected
                </div>
                {conflicts.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{c}</p>
                ))}
                <p className="text-xs text-muted-foreground italic">
                  You can still save — conflicts are blocked at booking time, not at availability setup.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={!form.service_id || createAvail.isPending || updateAvail.isPending}
            >
              {!editingId && selectedDays.length > 1 
                ? `Save for ${selectedDays.length} days` 
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SpaCompletionDialog
        open={!!completionAppointment}
        onOpenChange={(open) => {
          if (!open) setCompletionAppointment(null);
        }}
        appointment={completionAppointment}
        retroactive={isRetroactive}
      />

      <IntakeFormViewDialog
        open={!!intakeViewAppointment}
        onOpenChange={(open) => { if (!open) setIntakeViewAppointment(null); }}
        appointmentId={intakeViewAppointment?.id ?? null}
        clientName={
          intakeViewAppointment?.customer
            ? `${intakeViewAppointment.customer.first_name} ${intakeViewAppointment.customer.last_name}`.trim() || intakeViewAppointment.customer.email
            : intakeViewAppointment?.member
            ? `${intakeViewAppointment.member.first_name} ${intakeViewAppointment.member.last_name}`
            : undefined
        }
        serviceName={intakeViewAppointment?.service_name}
      />
    </div>
  );
}
