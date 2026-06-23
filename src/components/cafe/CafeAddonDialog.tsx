import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { toast } from "sonner";
import type { CafeMenuAddon, CafeMenuItem } from "@/hooks/useCafeMenu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CafeMenuItem | null;
  itemDisplayName: string;
  addons: CafeMenuAddon[];
  onConfirm: (selected: CafeMenuAddon[]) => void;
}

interface AddonGroup {
  name: string;
  type: "single" | "multi";
  required: boolean;
  addons: CafeMenuAddon[];
}

const PREFERRED_GROUP_ORDER = ["Temperature", "Sweetness", "Milk"];

function groupAddons(addons: CafeMenuAddon[]): AddonGroup[] {
  const map = new Map<string, AddonGroup>();
  for (const a of addons) {
    const key = a.group_name || "Add-ons";
    const type = (a.selection_type === "single" ? "single" : "multi") as "single" | "multi";
    if (!map.has(key)) {
      map.set(key, { name: key, type, required: !!a.is_required, addons: [] });
    }
    const g = map.get(key)!;
    g.addons.push(a);
    if (a.is_required) g.required = true;
  }
  for (const g of map.values()) {
    g.addons.sort((x, y) => (x.display_order ?? 0) - (y.display_order ?? 0));
  }
  return Array.from(map.values()).sort((a, b) => {
    const ai = PREFERRED_GROUP_ORDER.indexOf(a.name);
    const bi = PREFERRED_GROUP_ORDER.indexOf(b.name);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    // Put plain add-ons last
    if (a.name === "Add-ons") return 1;
    if (b.name === "Add-ons") return -1;
    return a.name.localeCompare(b.name);
  });
}

export function CafeAddonDialog({
  open,
  onOpenChange,
  item,
  itemDisplayName,
  addons,
  onConfirm,
}: Props) {
  const groups = useMemo(() => groupAddons(addons), [addons]);

  // singleSelections: groupName -> addonId
  const [singleSelections, setSingleSelections] = useState<Record<string, string>>({});
  // multiSelections: set of addon ids
  const [multiSelections, setMultiSelections] = useState<Set<string>>(new Set());

  // Reset / initialize selections when item or dialog opens
  useEffect(() => {
    if (!open) return;
    const defaults: Record<string, string> = {};
    for (const g of groups) {
      if (g.type === "single" && g.required && g.addons[0]) {
        defaults[g.name] = g.addons[0].id;
      }
    }
    setSingleSelections(defaults);
    setMultiSelections(new Set());
  }, [open, item?.id, groups]);

  const selectedAddons: CafeMenuAddon[] = useMemo(() => {
    const out: CafeMenuAddon[] = [];
    for (const g of groups) {
      if (g.type === "single") {
        const id = singleSelections[g.name];
        const a = g.addons.find((x) => x.id === id);
        if (a) out.push(a);
      } else {
        for (const a of g.addons) if (multiSelections.has(a.id)) out.push(a);
      }
    }
    return out;
  }, [groups, singleSelections, multiSelections]);

  const addonsTotal = selectedAddons.reduce((s, a) => s + Number(a.price || 0), 0);
  const itemPrice = Number(item?.price || 0);
  const total = itemPrice + addonsTotal;

  if (!item) return null;

  const toggleMulti = (id: string, checked: boolean) => {
    setMultiSelections((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleConfirm = () => {
    // Validate required single groups
    for (const g of groups) {
      if (g.type === "single" && g.required && !singleSelections[g.name]) {
        toast.error(`Please choose a ${g.name.toLowerCase()}`);
        return;
      }
    }
    onConfirm(selectedAddons);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize {itemDisplayName}</DialogTitle>
          <DialogDescription>
            Make it yours — pick how you'd like it prepared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 max-h-[55vh] overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No options available.</p>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-sm font-semibold tracking-wide uppercase">
                    {g.name}
                  </h4>
                  {g.required && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Required
                    </span>
                  )}
                </div>

                {g.type === "single" ? (
                  <RadioGroup
                    value={singleSelections[g.name] || ""}
                    onValueChange={(v) =>
                      setSingleSelections((prev) => ({ ...prev, [g.name]: v }))
                    }
                    className="grid grid-cols-2 gap-2"
                  >
                    {g.addons.map((a) => {
                      const id = `addon-${a.id}`;
                      const checked = singleSelections[g.name] === a.id;
                      return (
                        <label
                          key={a.id}
                          htmlFor={id}
                          className={`flex items-center justify-between gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
                            checked
                              ? "border-primary bg-primary/5"
                              : "bg-muted/30 hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value={a.id} id={id} />
                            <span className="text-sm font-medium">{a.name}</span>
                          </div>
                          {Number(a.price) > 0 && (
                            <span className="text-xs text-gold font-semibold">
                              +${Number(a.price).toFixed(2)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {g.addons.map((a) => {
                      const checked = multiSelections.has(a.id);
                      return (
                        <label
                          key={a.id}
                          className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleMulti(a.id, v === true)}
                            />
                            <span className="text-sm font-medium">{a.name}</span>
                          </div>
                          {Number(a.price) > 0 && (
                            <span className="text-sm text-gold font-semibold">
                              +${Number(a.price).toFixed(2)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{itemDisplayName}</span>
            <span>${itemPrice.toFixed(2)}</span>
          </div>
          {selectedAddons
            .filter((a) => Number(a.price) > 0)
            .map((a) => (
              <div key={a.id} className="flex justify-between text-muted-foreground">
                <span>+ {a.name}</span>
                <span>${Number(a.price).toFixed(2)}</span>
              </div>
            ))}
          <div className="flex justify-between font-semibold pt-1 border-t">
            <span>Item total</span>
            <span className="text-accent">${total.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Add to order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
