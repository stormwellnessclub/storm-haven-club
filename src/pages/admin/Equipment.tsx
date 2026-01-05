import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment, type Equipment } from "@/hooks/useEquipment";
import { useState } from "react";
import { Loader2, Plus, Edit, Trash2, Save, X, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const EQUIPMENT_CATEGORIES = [
  { value: "cardio", label: "Cardio" },
  { value: "strength", label: "Strength" },
  { value: "functional", label: "Functional" },
  { value: "free_weights", label: "Free Weights" },
  { value: "machines", label: "Machines" },
  { value: "accessories", label: "Accessories" },
  { value: "recovery", label: "Recovery" },
];

export default function Equipment() {
  const { data: equipment, isLoading } = useAllEquipment();
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "strength" as Equipment["category"],
    description: "",
    image_url: "",
    technogym_id: "",
    technogym_exercise_id: "",
    display_order: 0,
  });

  const handleOpenDialog = (equip?: Equipment) => {
    if (equip) {
      setEditingEquipment(equip);
      setFormData({
        name: equip.name,
        category: equip.category,
        description: equip.description || "",
        image_url: equip.image_url || "",
        technogym_id: equip.technogym_id || "",
        technogym_exercise_id: equip.technogym_exercise_id || "",
        display_order: equip.display_order,
      });
    } else {
      setEditingEquipment(null);
      setFormData({
        name: "",
        category: "strength",
        description: "",
        image_url: "",
        technogym_id: "",
        technogym_exercise_id: "",
        display_order: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEquipment(null);
    setFormData({
      name: "",
      category: "strength",
      description: "",
      image_url: "",
      technogym_id: "",
      technogym_exercise_id: "",
      display_order: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter equipment name");
      return;
    }

    try {
      if (editingEquipment) {
        await updateEquipment.mutateAsync({
          id: editingEquipment.id,
          ...formData,
        });
      } else {
        await createEquipment.mutateAsync({
          ...formData,
          is_active: true,
        });
      }
      handleCloseDialog();
    } catch (error: any) {
      toast.error(error.message || "Failed to save equipment");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will mark it as inactive.`)) {
      return;
    }

    try {
      await deleteEquipment.mutateAsync(id);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete equipment");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Implement Supabase Storage upload
    // For now, just show a message
    toast.info("Image upload feature coming soon. Please provide a URL manually.");
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Group equipment by category
  const equipmentByCategory = equipment?.reduce((acc, equip) => {
    if (!acc[equip.category]) {
      acc[equip.category] = [];
    }
    acc[equip.category].push(equip);
    return acc;
  }, {} as Record<string, Equipment[]>) || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipment Management</h1>
            <p className="text-muted-foreground">
              Manage gym equipment for workout generation and member fitness profiles
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEquipment ? "Edit Equipment" : "Add New Equipment"}
                </DialogTitle>
                <DialogDescription>
                  Add or update equipment information. Equipment will be available for members to select in their fitness profiles.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Equipment Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Dumbbells, Treadmill"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value as Equipment["category"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the equipment"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      type="url"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('image-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                  {formData.image_url && (
                    <div className="mt-2">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="technogym_id">Technogym Equipment ID</Label>
                    <Input
                      id="technogym_id"
                      value={formData.technogym_id}
                      onChange={(e) => setFormData({ ...formData, technogym_id: e.target.value })}
                      placeholder="e.g., TREADMILL_001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="technogym_exercise_id">Technogym Exercise ID</Label>
                    <Input
                      id="technogym_exercise_id"
                      value={formData.technogym_exercise_id}
                      onChange={(e) => setFormData({ ...formData, technogym_exercise_id: e.target.value })}
                      placeholder="e.g., EXERCISE_001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower numbers appear first in lists. Default: 0
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEquipment.isPending || updateEquipment.isPending}>
                    {(createEquipment.isPending || updateEquipment.isPending) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Equipment by Category */}
        {Object.keys(equipmentByCategory).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No equipment added yet</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Equipment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {EQUIPMENT_CATEGORIES.map((category) => {
              const categoryEquipment = equipmentByCategory[category.value] || [];
              if (categoryEquipment.length === 0) return null;

              return (
                <Card key={category.value}>
                  <CardHeader>
                    <CardTitle>{category.label} Equipment</CardTitle>
                    <CardDescription>
                      {categoryEquipment.length} {categoryEquipment.length === 1 ? 'item' : 'items'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryEquipment.map((equip) => (
                        <div
                          key={equip.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          {equip.image_url && (
                            <div className="aspect-square mb-3 rounded overflow-hidden bg-muted">
                              <img
                                src={equip.image_url}
                                alt={equip.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold">{equip.name}</h3>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenDialog(equip)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDelete(equip.id, equip.name)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {equip.description && (
                              <p className="text-sm text-muted-foreground">{equip.description}</p>
                            )}
                            {equip.technogym_id && (
                              <p className="text-xs text-muted-foreground">
                                Technogym ID: {equip.technogym_id}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

