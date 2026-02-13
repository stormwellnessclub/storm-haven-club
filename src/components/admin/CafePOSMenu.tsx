import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coffee, Plus, Loader2 } from "lucide-react";
import {
  useCafeMenuCategories,
  useCafeMenuItems,
  useCafeMenuAddons,
  useAddCafeCategory,
  useAddCafeMenuItem,
  useAddCafeAddon,
  type CafeMenuCategory,
  type CafeMenuItem,
  type CafeMenuAddon,
} from "@/hooks/useCafeMenu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface POSCartItem {
  itemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  categoryName: string;
  proteinFlavor?: string;
  addons: { name: string; price: number }[];
}

interface CafePOSMenuProps {
  onAddToCart: (item: POSCartItem) => void;
}

export function CafePOSMenu({ onAddToCart }: CafePOSMenuProps) {
  const { data: categories = [] } = useCafeMenuCategories();
  const { data: items = [] } = useCafeMenuItems();
  const { data: addons = [] } = useCafeMenuAddons();

  const addCategory = useAddCafeCategory();
  const addItem = useAddCafeMenuItem();
  const addAddon = useAddCafeAddon();

  // Add category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Add item form
  const [addingItemCatId, setAddingItemCatId] = useState<string | null>(null);
  const [newItemFields, setNewItemFields] = useState({ brand_name: "", flavor: "", item_name: "", size: "", price: "" });

  // Add addon form
  const [addingAddonCatId, setAddingAddonCatId] = useState<string | null>(null);
  const [newAddonFields, setNewAddonFields] = useState({ name: "", price: "" });

  // Protein shake customization
  const [proteinFlavor, setProteinFlavor] = useState("vanilla");
  const [customFlavor, setCustomFlavor] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addCategory.mutateAsync(newCategoryName.trim());
    setNewCategoryName("");
    setShowAddCategory(false);
  };

  const handleAddItem = async (categoryId: string) => {
    const price = parseFloat(newItemFields.price);
    if (isNaN(price) || price <= 0) return;
    await addItem.mutateAsync({
      category_id: categoryId,
      brand_name: newItemFields.brand_name || undefined,
      flavor: newItemFields.flavor || undefined,
      item_name: newItemFields.item_name || undefined,
      size: newItemFields.size || undefined,
      price,
    });
    setNewItemFields({ brand_name: "", flavor: "", item_name: "", size: "", price: "" });
    setAddingItemCatId(null);
  };

  const handleAddAddon = async (categoryId: string) => {
    const price = parseFloat(newAddonFields.price);
    if (!newAddonFields.name.trim() || isNaN(price) || price <= 0) return;
    await addAddon.mutateAsync({ name: newAddonFields.name.trim(), price, category_id: categoryId });
    setNewAddonFields({ name: "", price: "" });
    setAddingAddonCatId(null);
  };

  const getItemLabel = (item: CafeMenuItem) => {
    const parts: string[] = [];
    if (item.brand_name) parts.push(item.brand_name);
    if (item.item_name) parts.push(item.item_name);
    if (item.flavor) parts.push(item.flavor);
    if (item.size) parts.push(`(${item.size})`);
    return parts.length > 0 ? parts.join(" - ") : "Unnamed Item";
  };

  const handleItemClick = (item: CafeMenuItem, category: CafeMenuCategory) => {
    if (category.has_addons) return; // handled by protein shake section

    onAddToCart({
      itemId: item.id,
      name: getItemLabel(item),
      basePrice: Number(item.price),
      quantity: 1,
      categoryName: category.name,
      addons: [],
    });
  };

  const handleAddProteinShake = (item: CafeMenuItem, category: CafeMenuCategory) => {
    const flavor = proteinFlavor === "other" ? customFlavor.trim() || "Custom" : proteinFlavor;
    const selectedAddonDetails = addons
      .filter((a) => selectedAddons.includes(a.id))
      .map((a) => ({ name: a.name, price: Number(a.price) }));

    onAddToCart({
      itemId: item.id,
      name: `${getItemLabel(item)} (${flavor})`,
      basePrice: Number(item.price),
      quantity: 1,
      categoryName: category.name,
      proteinFlavor: flavor,
      addons: selectedAddonDetails,
    });
    setSelectedAddons([]);
    setProteinFlavor("vanilla");
    setCustomFlavor("");
  };

  const defaultTab = categories.length > 0 ? categories[0].id : "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Menu
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddCategory(true)}>
            <Plus className="h-3 w-3 mr-1" /> Category
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAddCategory && (
          <div className="flex gap-2 items-end border rounded-lg p-2 bg-muted/50">
            <div className="flex-1">
              <Label className="text-xs">New Category Name</Label>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Kombucha" />
            </div>
            <Button size="sm" onClick={handleAddCategory} disabled={addCategory.isPending}>
              {addCategory.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddCategory(false)}>Cancel</Button>
          </div>
        )}

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No categories yet. Add one above.</p>
        ) : (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              {categories.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((cat) => {
              const catItems = items.filter((i) => i.category_id === cat.id);
              const catAddons = addons.filter((a) => a.category_id === cat.id);

              return (
                <TabsContent key={cat.id} value={cat.id} className="space-y-3 mt-3">
                  {/* Items grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {catItems.map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="h-auto p-3 flex flex-col items-start text-left"
                        onClick={() => !cat.has_addons && handleItemClick(item, cat)}
                      >
                        <span className="font-medium text-xs leading-tight">{getItemLabel(item)}</span>
                        <span className="text-xs text-muted-foreground">${Number(item.price).toFixed(2)}</span>
                      </Button>
                    ))}
                  </div>

                  {/* Protein shake customization */}
                  {cat.has_addons && catItems.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                      <p className="text-sm font-medium">Customize Shake</p>
                      <div className="flex gap-2 items-end flex-wrap">
                        <div>
                          <Label className="text-xs">Select Item</Label>
                          <Select>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Pick shake..." />
                            </SelectTrigger>
                            <SelectContent>
                              {catItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{getItemLabel(item)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Flavor</Label>
                          <Select value={proteinFlavor} onValueChange={setProteinFlavor}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vanilla">Vanilla</SelectItem>
                              <SelectItem value="chocolate">Chocolate</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {proteinFlavor === "other" && (
                          <div>
                            <Label className="text-xs">Custom Flavor</Label>
                            <Input className="w-[140px]" value={customFlavor} onChange={(e) => setCustomFlavor(e.target.value)} placeholder="Specify..." />
                          </div>
                        )}
                      </div>
                      {catAddons.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs">Add-ons</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {catAddons.map((addon) => (
                              <label key={addon.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox
                                  checked={selectedAddons.includes(addon.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedAddons((prev) =>
                                      checked ? [...prev, addon.id] : prev.filter((id) => id !== addon.id)
                                    );
                                  }}
                                />
                                {addon.name} <Badge variant="secondary" className="text-xs">+${Number(addon.price).toFixed(2)}</Badge>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          const shakeSelect = document.querySelector<HTMLButtonElement>(`[data-cat-shake="${cat.id}"]`);
                          // Use first item as default if none selected
                          const selectedItem = catItems[0];
                          if (selectedItem) handleAddProteinShake(selectedItem, cat);
                        }}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  )}

                  {/* Add-on management for categories with addons */}
                  {cat.has_addons && (
                    <div className="flex gap-2">
                      {addingAddonCatId === cat.id ? (
                        <div className="flex gap-2 items-end border rounded p-2 bg-muted/50 w-full">
                          <div className="flex-1">
                            <Label className="text-xs">Add-on Name</Label>
                            <Input value={newAddonFields.name} onChange={(e) => setNewAddonFields((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Collagen" />
                          </div>
                          <div className="w-24">
                            <Label className="text-xs">Price ($)</Label>
                            <Input type="number" step="0.01" value={newAddonFields.price} onChange={(e) => setNewAddonFields((p) => ({ ...p, price: e.target.value }))} />
                          </div>
                          <Button size="sm" onClick={() => handleAddAddon(cat.id)} disabled={addAddon.isPending}>Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setAddingAddonCatId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setAddingAddonCatId(cat.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add-on
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Add item to category */}
                  {addingItemCatId === cat.id ? (
                    <div className="border rounded-lg p-3 space-y-2 bg-muted/50">
                      <p className="text-xs font-medium">Add New Item to {cat.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Brand</Label>
                          <Input value={newItemFields.brand_name} onChange={(e) => setNewItemFields((p) => ({ ...p, brand_name: e.target.value }))} placeholder="e.g. Fiji" />
                        </div>
                        <div>
                          <Label className="text-xs">Name / Flavor</Label>
                          <Input value={newItemFields.flavor} onChange={(e) => setNewItemFields((p) => ({ ...p, flavor: e.target.value }))} placeholder="e.g. Sparkling" />
                        </div>
                        <div>
                          <Label className="text-xs">Size</Label>
                          <Input value={newItemFields.size} onChange={(e) => setNewItemFields((p) => ({ ...p, size: e.target.value }))} placeholder="e.g. 16oz" />
                        </div>
                        <div>
                          <Label className="text-xs">Price ($)</Label>
                          <Input type="number" step="0.01" value={newItemFields.price} onChange={(e) => setNewItemFields((p) => ({ ...p, price: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddItem(cat.id)} disabled={addItem.isPending}>
                          {addItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Item"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingItemCatId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setAddingItemCatId(cat.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
