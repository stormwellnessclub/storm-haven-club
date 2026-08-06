import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem as SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Edit2, Upload, Save, X, Loader2, ImageIcon, Leaf, Snowflake, Package,
  ArrowUp, ArrowDown,
} from "lucide-react";
import {
  useAllCafeMenuCategories,
  useAllCafeMenuItems,
  useAddCafeCategory,
  useAddCafeMenuItem,
  useUpdateCafeMenuItem,
  useUpdateCafeCategory,
  useCafeMenuAddons,
  useAllCafeMenuAddons,
  useAddCafeAddon,
  useUpdateCafeAddon,
  uploadCafeMenuImage,
  type CafeMenuCategory,
  type CafeMenuItem,
  type CafeMenuAddon,
  type CafeMenuSection,
} from "@/hooks/useCafeMenu";
import { MultiImageUploader } from "@/components/admin/MultiImageUploader";

import { useCafeMenuRealtime } from "@/hooks/useCafeMenuRealtime";

export default function CafeMenuManager() {
  useCafeMenuRealtime("cafe-menu-admin");
  const { data: categories = [], isLoading: catLoading } = useAllCafeMenuCategories();
  const { data: allItems = [], isLoading: itemsLoading } = useAllCafeMenuItems();
  const addCategory = useAddCafeCategory();
  const addItem = useAddCafeMenuItem();
  const updateItem = useUpdateCafeMenuItem();
  const updateCategory = useUpdateCafeCategory();
  const { data: allAddons = [] } = useAllCafeMenuAddons();
  const addAddon = useAddCafeAddon();
  const updateAddon = useUpdateCafeAddon();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingItem, setEditingItem] = useState<CafeMenuItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CafeMenuCategory | null>(null);
  

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];
  const categoryItems = allItems.filter((i) => i.category_id === selectedCategory?.id);
  const categoryAddons = allAddons.filter((a) => a.category_id === selectedCategory?.id);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addCategory.mutateAsync(newCategoryName.trim());
    setNewCategoryName("");
    setShowAddCategory(false);
  };

  const handleToggleItemActive = async (item: CafeMenuItem) => {
    await updateItem.mutateAsync({ id: item.id, is_active: !item.is_active });
    toast.success(item.is_active ? "Item disabled" : "Item enabled");
  };

  const handleToggleCategoryActive = async (cat: CafeMenuCategory) => {
    await updateCategory.mutateAsync({ id: cat.id, is_active: !cat.is_active });
    toast.success(cat.is_active ? "Category disabled" : "Category enabled");
  };

  const handleReorderCategory = async (cat: CafeMenuCategory, direction: 'up' | 'down') => {
    const sorted = [...categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      updateCategory.mutateAsync({ id: cat.id, display_order: other.display_order }),
      updateCategory.mutateAsync({ id: other.id, display_order: cat.display_order }),
    ]);
  };

  const handleReorderItem = async (item: CafeMenuItem, direction: 'up' | 'down') => {
    const sorted = [...categoryItems].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const idx = sorted.findIndex(i => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await Promise.all([
      updateItem.mutateAsync({ id: item.id, display_order: other.display_order }),
      updateItem.mutateAsync({ id: other.id, display_order: item.display_order }),
    ]);
  };

  const sectionLabel = (s: string) => s === 'cafe' ? 'Café' : s === 'spa' ? 'Spa' : 'Shop';

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cafe Menu Manager</h1>
            <p className="text-muted-foreground text-sm">Manage categories, items, prices, images, and availability</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Categories</CardTitle>
                <Button size="icon" variant="ghost" onClick={() => setShowAddCategory(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              {showAddCategory && (
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  />
                  <Button size="sm" onClick={handleAddCategory} disabled={addCategory.isPending}>
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddCategory(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {catLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                categories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors text-sm ${
                      selectedCategory?.id === cat.id
                        ? "bg-accent text-accent-foreground"
                        : cat.is_active
                        ? "hover:bg-muted"
                        : "opacity-50 hover:bg-muted"
                    }`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{sectionLabel(cat.section)}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <div className="flex flex-col">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          disabled={idx === 0}
                          onClick={(e) => { e.stopPropagation(); handleReorderCategory(cat, 'up'); }}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          disabled={idx === categories.length - 1}
                          onClick={(e) => { e.stopPropagation(); handleReorderCategory(cat, 'down'); }}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {allItems.filter((i) => i.category_id === cat.id).length}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory(cat);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Items Panel */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedCategory ? `Items in "${selectedCategory.name}"` : "Select a category"}
                </CardTitle>
                {selectedCategory && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedCategory.is_active}
                      onCheckedChange={() => handleToggleCategoryActive(selectedCategory)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedCategory.is_active ? "Active" : "Disabled"}
                    </span>
                    <Button size="sm" onClick={() => setShowAddItem(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {itemsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !selectedCategory ? (
                <p className="text-muted-foreground text-sm text-center py-12">Select a category from the left panel</p>
              ) : categoryItems.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-12">No items in this category yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Order</TableHead>
                      <TableHead className="w-12">Img</TableHead>
                      <TableHead>Name / Brand</TableHead>
                      <TableHead>Flavor / Size</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-center">Seasonal</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems.map((item, idx) => (
                      <TableRow key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex flex-col items-center gap-0.5">
                            <Button size="icon" variant="ghost" className="h-5 w-5" disabled={idx === 0}
                              onClick={() => handleReorderItem(item, 'up')}>
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5" disabled={idx === categoryItems.length - 1}
                              onClick={() => handleReorderItem(item, 'down')}>
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.item_name || item.brand_name || "—"}</span>
                            {item.brand_name && item.item_name && (
                              <span className="text-xs text-muted-foreground block">{item.brand_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.flavor && <span>{item.flavor}</span>}
                            {item.size && <span className="text-muted-foreground ml-1">({item.size})</span>}
                          </div>
                          {item.dietary_tags && item.dietary_tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {item.dietary_tags.map((t) => (
                                <Badge key={t} variant="outline" className="text-[10px] px-1 py-0">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">${item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          {item.stock_quantity === null ? (
                            <span className="text-muted-foreground text-xs">∞</span>
                          ) : item.stock_quantity === 0 ? (
                            <Badge variant="destructive" className="text-xs">Sold Out</Badge>
                          ) : (
                            <span className="text-sm">{item.stock_quantity}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.is_seasonal && (
                            <Badge variant="secondary" className="text-xs">
                              <Snowflake className="h-3 w-3 mr-1" />
                              {item.seasonal_label || "Seasonal"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={() => handleToggleItemActive(item)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add-ons Panel - shown when category has_addons */}
          {selectedCategory?.has_addons && (
            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Add-ons for "{selectedCategory.name}"
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newAddonName}
                    onChange={(e) => setNewAddonName(e.target.value)}
                    placeholder="Add-on name (e.g. Extra Shot)"
                    className="max-w-xs"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(e.target.value)}
                    placeholder="Price"
                    className="max-w-[120px]"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const price = parseFloat(newAddonPrice);
                      if (!newAddonName.trim() || isNaN(price) || price <= 0) {
                        toast.error("Name and valid price required");
                        return;
                      }
                      await addAddon.mutateAsync({ name: newAddonName.trim(), price, category_id: selectedCategory.id });
                      setNewAddonName("");
                      setNewAddonPrice("");
                    }}
                    disabled={addAddon.isPending}
                  >
                    {addAddon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add Add-on</>}
                  </Button>
                </div>
                {categoryAddons.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No add-ons yet. Add one above.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryAddons.map((addon) => (
                        <TableRow key={addon.id} className={!addon.is_active ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{addon.name}</TableCell>
                          <TableCell className="text-right font-mono">${addon.price.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={addon.is_active}
                              onCheckedChange={async () => {
                                await updateAddon.mutateAsync({ id: addon.id, is_active: !addon.is_active });
                                toast.success(addon.is_active ? "Add-on disabled" : "Add-on enabled");
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Item Dialog */}
      <ItemEditDialog
        item={editingItem}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={async (updates) => {
          if (!editingItem) return;
          await updateItem.mutateAsync({ id: editingItem.id, ...updates });
          toast.success("Item updated");
          setEditingItem(null);
        }}
        onPersistImages={async (urls) => {
          if (!editingItem) return;
          await updateItem.mutateAsync({
            id: editingItem.id,
            image_urls: urls,
            image_url: urls[0] ?? null,
          });
        }}
      />

      {/* Add Item Dialog */}
      {selectedCategory && (
        <AddItemDialog
          categoryId={selectedCategory.id}
          open={showAddItem}
          onClose={() => setShowAddItem(false)}
          onSave={async (item) => {
            await addItem.mutateAsync(item);
            setShowAddItem(false);
          }}
          isPending={addItem.isPending}
        />
      )}

      {/* Edit Category Dialog */}
      <CategoryEditDialog
        category={editingCategory}
        open={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        onSave={async (updates) => {
          if (!editingCategory) return;
          await updateCategory.mutateAsync({ id: editingCategory.id, ...updates });
          toast.success("Category updated");
          setEditingCategory(null);
        }}
      />
    </AdminLayout>
  );
}

// ---- Item Edit Dialog ----
function ItemEditDialog({
  item,
  open,
  onClose,
  onSave,
  onPersistImages,
}: {
  item: CafeMenuItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<CafeMenuItem>) => Promise<void>;
  onPersistImages: (urls: string[]) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<CafeMenuItem>>({});
  const [saving, setSaving] = useState(false);

  // Reset form when item changes
  const resetForm = () => {
    if (item) {
      setForm({
        item_name: item.item_name,
        brand_name: item.brand_name,
        flavor: item.flavor,
        size: item.size,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
        image_urls: item.image_urls || (item.image_url ? [item.image_url] : []),
        stock_quantity: item.stock_quantity,
        is_seasonal: item.is_seasonal,
        seasonal_label: item.seasonal_label,
        display_order: item.display_order,
        calories: item.calories,
        dietary_tags: item.dietary_tags,
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); else resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onOpenAutoFocus={() => resetForm()}>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Item Name</Label>
              <Input value={form.item_name || ""} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={form.brand_name || ""} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} />
            </div>
            <div>
              <Label>Flavor</Label>
              <Input value={form.flavor || ""} onChange={(e) => setForm((f) => ({ ...f, flavor: e.target.value }))} />
            </div>
            <div>
              <Label>Size</Label>
              <Input value={form.size || ""} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
            </div>
            <div>
              <Label>Price ($)</Label>
              <Input type="number" step="0.01" value={form.price ?? ""} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Calories</Label>
              <Input type="number" value={form.calories ?? ""} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value ? parseInt(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Stock Qty</Label>
              <Input type="number" placeholder="∞ (blank = unlimited)" value={form.stock_quantity ?? ""} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value ? parseInt(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input type="number" value={form.display_order ?? 0} onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Dietary Tags (comma separated)</Label>
            <Input
              value={(form.dietary_tags || []).join(", ")}
              onChange={(e) => setForm((f) => ({ ...f, dietary_tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
              placeholder="Vegan, GF, Dairy-Free"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_seasonal || false} onCheckedChange={(v) => setForm((f) => ({ ...f, is_seasonal: v }))} />
              <Label>Seasonal</Label>
            </div>
            {form.is_seasonal && (
              <Input
                placeholder="e.g. Summer Special"
                value={form.seasonal_label || ""}
                onChange={(e) => setForm((f) => ({ ...f, seasonal_label: e.target.value }))}
                className="flex-1"
              />
            )}
          </div>
          <MultiImageUploader
            label="Images"
            value={form.image_urls || []}
            onChange={(urls) => setForm((f) => ({ ...f, image_urls: urls, image_url: urls[0] ?? null }))}
            onPersist={onPersistImages}
            upload={uploadCafeMenuImage}
            maxImages={8}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Add Item Dialog ----
function AddItemDialog({
  categoryId,
  open,
  onClose,
  onSave,
  isPending,
}: {
  categoryId: string;
  open: boolean;
  onClose: () => void;
  onSave: (item: any) => Promise<void>;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    item_name: "",
    brand_name: "",
    flavor: "",
    size: "",
    description: "",
    price: 0,
    calories: null as number | null,
    dietary_tags: [] as string[],
    is_seasonal: false,
    seasonal_label: "",
    stock_quantity: null as number | null,
    image_urls: [] as string[],
  });

  const handleSubmit = async () => {
    if (!form.item_name && !form.brand_name) {
      toast.error("Item name or brand is required");
      return;
    }
    if (form.price <= 0) {
      toast.error("Price is required");
      return;
    }
    await onSave({
      category_id: categoryId,
      item_name: form.item_name || null,
      brand_name: form.brand_name || null,
      flavor: form.flavor || null,
      size: form.size || null,
      description: form.description || null,
      price: form.price,
      calories: form.calories,
      dietary_tags: form.dietary_tags.length > 0 ? form.dietary_tags : null,
      is_seasonal: form.is_seasonal,
      seasonal_label: form.seasonal_label || null,
      stock_quantity: form.stock_quantity,
      image_urls: form.image_urls,
      image_url: form.image_urls[0] || null,
    });
    // Reset
    setForm({
      item_name: "", brand_name: "", flavor: "", size: "", description: "", price: 0,
      calories: null, dietary_tags: [], is_seasonal: false, seasonal_label: "",
      stock_quantity: null, image_urls: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Item Name</Label>
              <Input value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} />
            </div>
            <div>
              <Label>Flavor</Label>
              <Input value={form.flavor} onChange={(e) => setForm((f) => ({ ...f, flavor: e.target.value }))} />
            </div>
            <div>
              <Label>Size</Label>
              <Input value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
            </div>
            <div>
              <Label>Price ($) *</Label>
              <Input type="number" step="0.01" value={form.price || ""} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Calories</Label>
              <Input type="number" value={form.calories ?? ""} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value ? parseInt(e.target.value) : null }))} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Dietary Tags (comma separated)</Label>
            <Input
              value={form.dietary_tags.join(", ")}
              onChange={(e) => setForm((f) => ({ ...f, dietary_tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
              placeholder="Vegan, GF, Dairy-Free"
            />
          </div>
          <div>
            <Label>Stock Quantity (leave blank for unlimited)</Label>
            <Input type="number" value={form.stock_quantity ?? ""} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value ? parseInt(e.target.value) : null }))} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_seasonal} onCheckedChange={(v) => setForm((f) => ({ ...f, is_seasonal: v }))} />
              <Label>Seasonal</Label>
            </div>
            {form.is_seasonal && (
              <Input placeholder="e.g. Summer Special" value={form.seasonal_label} onChange={(e) => setForm((f) => ({ ...f, seasonal_label: e.target.value }))} className="flex-1" />
            )}
          </div>
          <MultiImageUploader
            label="Images"
            value={form.image_urls}
            onChange={(urls) => setForm((f) => ({ ...f, image_urls: urls }))}
            upload={uploadCafeMenuImage}
            maxImages={8}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Category Edit Dialog ----
function CategoryEditDialog({
  category,
  open,
  onClose,
  onSave,
}: {
  category: CafeMenuCategory | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<CafeMenuCategory>) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "", has_addons: false, section: "cafe" as CafeMenuSection });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) onClose();
      else if (category) setForm({ name: category.name, description: category.description || "", has_addons: category.has_addons, section: category.section || 'cafe' });
    }}>
      <DialogContent className="max-w-md" onOpenAutoFocus={() => {
        if (category) setForm({ name: category.name, description: category.description || "", has_addons: category.has_addons, section: category.section || 'cafe' });
      }}>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Section</Label>
            <Select value={form.section} onValueChange={(v) => setForm((f) => ({ ...f, section: v as CafeMenuSection }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectOption value="cafe">Café</SelectOption>
                <SelectOption value="spa">Spa</SelectOption>
                <SelectOption value="shop">Storm Shop</SelectOption>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.has_addons} onCheckedChange={(v) => setForm((f) => ({ ...f, has_addons: v }))} />
            <Label>Has Add-ons</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={async () => {
              setSaving(true);
              try { await onSave(form); } finally { setSaving(false); }
            }} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
