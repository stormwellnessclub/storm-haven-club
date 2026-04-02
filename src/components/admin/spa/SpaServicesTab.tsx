import { useState } from "react";
import { useSpaServices, useUpdateSpaService, type SpaService } from "@/hooks/useSpaManagement";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Search } from "lucide-react";

export function SpaServicesTab() {
  const { data: services, isLoading } = useSpaServices();
  const updateService = useUpdateSpaService();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editing, setEditing] = useState<SpaService | null>(null);

  const categories = ["All", ...new Set(services?.map(s => s.category) || [])];

  const filtered = services?.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) || [];

  const handleToggleActive = (service: SpaService) => {
    updateService.mutate({ id: service.id, is_active: !service.is_active });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    updateService.mutate(editing, { onSuccess: () => setEditing(null) });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <Button
              key={cat}
              size="sm"
              variant={categoryFilter === cat ? "default" : "outline"}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} service{filtered.length !== 1 ? "s" : ""}
            {categoryFilter !== "All" && ` in ${categoryFilter}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map(service => (
              <div key={service.id} className="flex items-center gap-4 px-4 py-3">
                <Switch
                  checked={service.is_active}
                  onCheckedChange={() => handleToggleActive(service)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{service.name}</span>
                    {service.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {service.duration_minutes} min · ${Number(service.price).toFixed(0)}
                    {service.member_price && ` / $${Number(service.member_price).toFixed(0)} member`}
                  </div>
                </div>
                <Badge variant={service.is_active ? "default" : "outline"} className="text-xs">
                  {service.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => setEditing({ ...service })}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Duration (min)</Label><Input type="number" value={editing.duration_minutes} onChange={e => setEditing({ ...editing, duration_minutes: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>Cleanup (min)</Label><Input type="number" value={editing.cleanup_minutes} onChange={e => setEditing({ ...editing, cleanup_minutes: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Price ($)</Label><Input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Member Price ($)</Label><Input type="number" value={editing.member_price || ""} onChange={e => setEditing({ ...editing, member_price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.popular} onCheckedChange={v => setEditing({ ...editing, popular: v })} />
                <Label>Popular</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateService.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
