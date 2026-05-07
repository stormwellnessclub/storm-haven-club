import { useState } from "react";
import {
  useSpaTherapists, useCreateSpaTherapist, useUpdateSpaTherapist, useDeleteSpaTherapist,
  useSpaServices, useSpaTherapistServices, useAssignTherapistService, useUnassignTherapistService,
  type SpaTherapist,
} from "@/hooks/useSpaManagement";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const emptyTherapist = (): Omit<SpaTherapist, "id" | "created_at" | "updated_at"> => ({
  full_name: "", email: null, phone: null, bio: null, specialties: [], photo_url: null, is_active: true, hourly_rate: 26,
});

export function SpaTherapistsTab() {
  const { data: therapists, isLoading } = useSpaTherapists();
  const { data: services } = useSpaServices();
  const { data: assignments } = useSpaTherapistServices();
  const createTherapist = useCreateSpaTherapist();
  const updateTherapist = useUpdateSpaTherapist();
  const deleteTherapist = useDeleteSpaTherapist();
  const assignService = useAssignTherapistService();
  const unassignService = useUnassignTherapistService();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTherapist());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [specialtyInput, setSpecialtyInput] = useState("");

  const openNew = () => { setForm(emptyTherapist()); setEditingId(null); setShowForm(true); };
  const openEdit = (t: SpaTherapist) => {
    setForm({ full_name: t.full_name, email: t.email, phone: t.phone, bio: t.bio, specialties: t.specialties || [], photo_url: t.photo_url, is_active: t.is_active, hourly_rate: t.hourly_rate ?? 26 });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateTherapist.mutate({ id: editingId, ...form }, { onSuccess: () => setShowForm(false) });
    } else {
      createTherapist.mutate(form, { onSuccess: () => setShowForm(false) });
    }
  };

  const addSpecialty = () => {
    if (specialtyInput.trim() && !form.specialties.includes(specialtyInput.trim())) {
      setForm({ ...form, specialties: [...form.specialties, specialtyInput.trim()] });
      setSpecialtyInput("");
    }
  };

  const toggleServiceAssignment = (therapistId: string, serviceId: string) => {
    const exists = assignments?.find(a => a.therapist_id === therapistId && a.service_id === serviceId);
    if (exists) {
      unassignService.mutate({ therapist_id: therapistId, service_id: serviceId });
    } else {
      assignService.mutate({ therapist_id: therapistId, service_id: serviceId });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const groupedServices = services?.reduce((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {} as Record<string, typeof services>) || {};

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{therapists?.length || 0} Therapist{(therapists?.length || 0) !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Therapist</Button>
      </div>

      <div className="space-y-3">
        {therapists?.map(therapist => {
          const therapistAssignments = assignments?.filter(a => a.therapist_id === therapist.id) || [];
          const isExpanded = expandedId === therapist.id;

          return (
            <Card key={therapist.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{therapist.full_name}</span>
                      <Badge variant={therapist.is_active ? "default" : "outline"} className="text-xs">
                        {therapist.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {therapist.specialties?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-1">
                        {therapist.specialties.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                      </div>
                    )}
                    {therapist.email && <p className="text-xs text-muted-foreground">{therapist.email}</p>}
                    <p className="text-xs text-muted-foreground">{therapistAssignments.length} service{therapistAssignments.length !== 1 ? "s" : ""} assigned</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : therapist.id)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(therapist)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {therapist.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>This will remove the therapist and all their service assignments.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTherapist.mutate(therapist.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">Assign Services</p>
                    {Object.entries(groupedServices).map(([category, svcs]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">{category}</p>
                        <div className="space-y-1">
                          {svcs!.map(svc => {
                            const isAssigned = !!assignments?.find(a => a.therapist_id === therapist.id && a.service_id === svc.id);
                            return (
                              <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                                <Checkbox checked={isAssigned} onCheckedChange={() => toggleServiceAssignment(therapist.id, svc.id)} />
                                {svc.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Therapist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value || null })} /></div>
              <div><Label>Phone</Label><Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value || null })} /></div>
            </div>
            <div><Label>Bio</Label><Textarea value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value || null })} /></div>
            <div>
              <Label>Specialties</Label>
              <div className="flex gap-2 mb-2">
                <Input value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)} placeholder="Add specialty" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSpecialty())} />
                <Button type="button" size="sm" onClick={addSpecialty}>Add</Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {form.specialties.map(s => (
                  <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setForm({ ...form, specialties: form.specialties.filter(x => x !== s) })}>
                    {s} ✕
                  </Badge>
                ))}
              </div>
            </div>
            <div><Label>Photo URL</Label><Input value={form.photo_url || ""} onChange={e => setForm({ ...form, photo_url: e.target.value || null })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.full_name || createTherapist.isPending || updateTherapist.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
