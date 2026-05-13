import { useMemo, useState } from "react";
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
import type { CafeMenuAddon, CafeMenuItem } from "@/hooks/useCafeMenu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CafeMenuItem | null;
  itemDisplayName: string;
  addons: CafeMenuAddon[];
  onConfirm: (selected: CafeMenuAddon[]) => void;
}

export function CafeAddonDialog({
  open,
  onOpenChange,
  item,
  itemDisplayName,
  addons,
  onConfirm,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selection when the item changes / dialog reopens
  useMemo(() => {
    if (open) setSelectedIds(new Set());
  }, [open, item?.id]);

  const selected = addons.filter((a) => selectedIds.has(a.id));
  const addonsTotal = selected.reduce((s, a) => s + Number(a.price || 0), 0);
  const itemPrice = Number(item?.price || 0);
  const total = itemPrice + addonsTotal;

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize {itemDisplayName}</DialogTitle>
          <DialogDescription>
            Pick any add-ons you'd like. Add-on prices are added to your total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
          {addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No add-ons available.</p>
          ) : (
            addons.map((a) => {
              const checked = selectedIds.has(a.id);
              return (
                <label
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(a.id, v === true)}
                    />
                    <span className="text-sm font-medium">{a.name}</span>
                  </div>
                  <span className="text-sm text-gold font-semibold">
                    +${Number(a.price || 0).toFixed(2)}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{itemDisplayName}</span>
            <span>${itemPrice.toFixed(2)}</span>
          </div>
          {selected.map((a) => (
            <div key={a.id} className="flex justify-between text-muted-foreground">
              <span>+ {a.name}</span>
              <span>${Number(a.price || 0).toFixed(2)}</span>
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
          <Button onClick={() => onConfirm(selected)}>Add to order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
