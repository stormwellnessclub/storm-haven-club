import { useState } from "react";
import { useSpaRooms, useCreateSpaRoom, useUpdateSpaRoom, useDeleteSpaRoom, type SpaRoom } from "@/hooks/useSpaManagement";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const ROOM_TYPES = ["treatment", "recovery", "wet", "consultation"];

const emptyRoom = (): Omit<SpaRoom, "id" | "created_at"> => ({
  name: "", description: null, room_type: "treatment", is_active: true,
});

export function SpaRoomsTab() {
  const { data: rooms, isLoading } = useSpaRooms();
  const createRoom = useCreateSpaRoom();
  const updateRoom = useUpdateSpaRoom();
  const deleteRoom = useDeleteSpaRoom();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRoom());

  const openNew = () => { setForm(emptyRoom()); setEditingId(null); setShowForm(true); };
  const openEdit = (r: SpaRoom) => {
    setForm({ name: r.name, description: r.description, room_type: r.room_type, is_active: r.is_active });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateRoom.mutate({ id: editingId, ...form }, { onSuccess: () => setShowForm(false) });
    } else {
      createRoom.mutate(form, { onSuccess: () => setShowForm(false) });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{rooms?.length || 0} Room{(rooms?.length || 0) !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Room</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms?.map(room => (
          <Card key={room.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{room.name}</p>
                  <Badge variant="secondary" className="text-xs capitalize mt-1">{room.room_type}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(room)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {room.name}?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove the room from all availability slots.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteRoom.mutate(room.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {room.description && <p className="text-xs text-muted-foreground mb-2">{room.description}</p>}
              <Badge variant={room.is_active ? "default" : "outline"} className="text-xs">
                {room.is_active ? "Active" : "Inactive"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value || null })} /></div>
            <div>
              <Label>Room Type</Label>
              <Select value={form.room_type} onValueChange={v => setForm({ ...form, room_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createRoom.isPending || updateRoom.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
