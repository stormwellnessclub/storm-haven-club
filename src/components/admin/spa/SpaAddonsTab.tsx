import { useState } from "react";
import { useSpaAddons, useCreateSpaAddon, useUpdateSpaAddon, useDeleteSpaAddon, type SpaServiceAddon } from "@/hooks/useSpaManagement";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const CATEGORIES = ["Body Rituals", "Body Wraps", "Massage", "Facials", "Recovery"];

const emptyAddon = (): Omit<SpaServiceAddon, "id" | "created_at"> => ({
  name: "", description: null, price: 0, duration_minutes: 0, is_active: true, applicable_categories: [],
});

export function SpaAddonsTab() {
  const { data: addons, isLoading } = useSpaAddons();
  const createAddon = useCreateSpaAddon();
  const updateAddon = useUpdateSpaAddon();
  const deleteAddon = useDeleteSpaAddon();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAddon());

  const openNew = () => { setForm(emptyAddon()); setEditingId(null); setShowForm(true); };
  const openEdit = (a: SpaServiceAddon) => {
    setForm({ name: a.name, description: a.description, price: a.price, duration_minutes: a.duration_minutes, is_active: a.is_active, applicable_categories: a.applicable_categories || [] });
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateAddon.mutate({ id: editingId, ...form }, { onSuccess: () => setShowForm(false) });
    } else {
      createAddon.mutate(form, { onSuccess: () => setShowForm(false) });
    }
  };

  const toggleCategory = (cat: string) => {
    setForm({
      ...form,
      applicable_categories: form.applicable_categories.includes(cat)
        ? form.applicable_categories.filter(c => c !== cat)
        : [...form.applicable_categories, cat],
    });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{addons?.length || 0} Add-On{(addons?.length || 0) !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Add-On</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {addons?.map(addon => (
          <Card key={addon.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-sm">{addon.name}</p>
                  <p className="text-sm text-muted-foreground">
                    +${Number(addon.price).toFixed(0)}
                    {addon.duration_minutes > 0 && ` · +${addon.duration_minutes} min`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(addon)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {addon.name}?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove this add-on.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAddon.mutate(addon.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {addon.description && <p className="text-xs text-muted-foreground mb-2">{addon.description}</p>}
              <div className="flex gap-1 flex-wrap">
                {addon.applicable_categories?.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
              </div>
              <Badge variant={addon.is_active ? "default" : "outline"} className="text-xs mt-2">
                {addon.is_active ? "Active" : "Inactive"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Add-On</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value || null })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Extra Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div>
              <Label>Applicable Categories</Label>
              <div className="space-y-1 mt-1">
                {CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.applicable_categories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                    {cat}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createAddon.isPending || updateAddon.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
