import { useState } from "react";
import {
  useSpaServices, useSpaTherapists, useSpaRooms,
  useSpaServiceAvailability, useCreateSpaAvailability, useUpdateSpaAvailability, useDeleteSpaAvailability,
  type SpaServiceAvailability,
} from "@/hooks/useSpaManagement";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emptySlot = (): Omit<SpaServiceAvailability, "id"> => ({
  service_id: "", therapist_id: null, room_id: null,
  day_of_week: 1, start_time: "09:00", end_time: "17:00",
  max_bookings: 1, is_active: true,
});

export function SpaAvailabilityTab() {
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

  const openNew = () => { setForm(emptySlot()); setEditingId(null); setShowForm(true); };
  const openEdit = (slot: SpaServiceAvailability) => {
    setForm({
      service_id: slot.service_id, therapist_id: slot.therapist_id, room_id: slot.room_id,
      day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time,
      max_bookings: slot.max_bookings, is_active: slot.is_active,
    });
    setEditingId(slot.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateAvail.mutate({ id: editingId, ...form }, { onSuccess: () => setShowForm(false) });
    } else {
      createAvail.mutate(form, { onSuccess: () => setShowForm(false) });
    }
  };

  const getServiceName = (id: string) => services?.find(s => s.id === id)?.name || "Unknown";
  const getTherapistName = (id: string | null) => id ? therapists?.find(t => t.id === id)?.full_name || "Unknown" : "Any";
  const getRoomName = (id: string | null) => id ? rooms?.find(r => r.id === id)?.name || "Unknown" : "Any";

  const filtered = filterService === "all"
    ? availability
    : availability?.filter(a => a.service_id === filterService);

  // Group by service
  const grouped = (filtered || []).reduce((acc, slot) => {
    const name = getServiceName(slot.service_id);
    (acc[name] = acc[name] || []).push(slot);
    return acc;
  }, {} as Record<string, SpaServiceAvailability[]>);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const activeServices = services?.filter(s => s.is_active) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Filter by service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {services?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Slot</Button>
      </div>

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
                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
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
            <div>
              <Label>Day of Week</Label>
              <Select value={String(form.day_of_week)} onValueChange={v => setForm({ ...form, day_of_week: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Time</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>End Time</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.service_id || createAvail.isPending || updateAvail.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
