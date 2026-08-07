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
import { Textarea } from "@/components/ui/textarea";
import { Flame, Snowflake } from "lucide-react";

import { toast } from "sonner";
import type { CafeMenuAddon, CafeMenuItem } from "@/hooks/useCafeMenu";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CafeMenuItem | null;
  itemDisplayName: string;
  addons: CafeMenuAddon[];
  onConfirm: (selected: CafeMenuAddon[], note?: string) => void;
}

interface AddonGroup {
  name: string;
  type: "single" | "multi";
  required: boolean;
  addons: CafeMenuAddon[];
}

const PREFERRED_GROUP_ORDER = ["Temperature", "Sweetness", "Milk", "Syrup"];

export const SPECIAL_INSTRUCTIONS_DISCLAIMER =
  "Tell us about allergies, sensitivities, or how you'd like it made. We'll do our best — but we can't guarantee every request can be accommodated, and we can't rule out cross-contact in a shared café space.";

const SWEETNESS_ORDER = ["unsweetened", "light", "regular", "extra"];
const SWEETNESS_LABELS: Record<string, string> = {
  unsweetened: "None",
  light: "Light",
  regular: "Regular",
  extra: "Extra",
};

const SUGAR_FREE_SUFFIX = " (Sugar-Free)";

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

/** Strip the "(Sugar-Free)" marker to get the base flavor name. */
const baseFlavor = (name: string) => name.replace(SUGAR_FREE_SUFFIX, "").trim();
const isSugarFree = (name: string) => name.includes(SUGAR_FREE_SUFFIX);

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
  const [note, setNote] = useState("");

  // Reset / initialize selections when item or dialog opens
  useEffect(() => {
    if (!open) return;
    const defaults: Record<string, string> = {};
    for (const g of groups) {
      if (g.name === "Sweetness") {
        const regular = g.addons.find((a) => a.name.toLowerCase() === "regular");
        if (regular) defaults[g.name] = regular.id;
        else if (g.required && g.addons[0]) defaults[g.name] = g.addons[0].id;
        continue;
      }
      if (g.name === "Syrup") {
        const none = g.addons.find((a) => /no syrup/i.test(a.name));
        if (none) defaults[g.name] = none.id;
        continue;
      }
      if (g.type === "single" && g.required && g.addons[0]) {
        defaults[g.name] = g.addons[0].id;
      }
    }
    setSingleSelections(defaults);
    setMultiSelections(new Set());
    setNote("");
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

  const selectSingle = (groupName: string, addonId: string) =>
    setSingleSelections((prev) => ({ ...prev, [groupName]: addonId }));

  const handleConfirm = () => {
    // Validate required single groups
    for (const g of groups) {
      if (g.type === "single" && g.required && !singleSelections[g.name]) {
        toast.error(`Please choose a ${g.name.toLowerCase()}`);
        return;
      }
    }
    onConfirm(selectedAddons, note.trim() || undefined);
  };

  // ---- Custom group renderers -------------------------------------------

  const renderTemperature = (g: AddonGroup) => (
    <div className="grid grid-cols-2 gap-3">
      {g.addons.map((a) => {
        const checked = singleSelections[g.name] === a.id;
        const hot = /hot/i.test(a.name);
        const Icon = hot ? Flame : Snowflake;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => selectSingle(g.name, a.id)}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 py-4 transition-colors ${
              checked
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/30 hover:bg-muted/60 text-foreground"
            }`}
          >
            <Icon className="h-6 w-6" />
            <span className="text-sm font-semibold">{a.name}</span>
            {Number(a.price) > 0 && (
              <span className="text-xs text-gold">+${Number(a.price).toFixed(2)}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderSweetness = (g: AddonGroup) => {
    const ordered = [...g.addons].sort(
      (a, b) =>
        SWEETNESS_ORDER.indexOf(a.name.toLowerCase()) -
        SWEETNESS_ORDER.indexOf(b.name.toLowerCase()),
    );
    const activeIdx = ordered.findIndex((a) => a.id === singleSelections[g.name]);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {ordered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => selectSingle(g.name, a.id)}
              aria-label={SWEETNESS_LABELS[a.name.toLowerCase()] || a.name}
              className={`h-2.5 flex-1 rounded-full transition-colors ${
                activeIdx >= 0 && i <= activeIdx ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {ordered.map((a) => {
            const checked = singleSelections[g.name] === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => selectSingle(g.name, a.id)}
                className={`rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {SWEETNESS_LABELS[a.name.toLowerCase()] || a.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSyrup = (g: AddonGroup) => {
    // Group by base flavor so Regular / Sugar-Free are one tile with a toggle
    const flavors: { base: string; regular?: CafeMenuAddon; sf?: CafeMenuAddon }[] = [];
    for (const a of g.addons) {
      const base = baseFlavor(a.name);
      let entry = flavors.find((f) => f.base === base);
      if (!entry) {
        entry = { base };
        flavors.push(entry);
      }
      if (isSugarFree(a.name)) entry.sf = a;
      else entry.regular = a;
    }

    const selectedId = singleSelections[g.name];
    const selectedAddon = g.addons.find((a) => a.id === selectedId);
    const selectedBase = selectedAddon ? baseFlavor(selectedAddon.name) : null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {flavors.map((f) => {
            const active = selectedBase === f.base;
            const target = f.regular || f.sf!;
            return (
              <button
                key={f.base}
                type="button"
                onClick={() => selectSingle(g.name, active ? target.id : target.id)}
                className={`flex items-center justify-between gap-2 rounded-md border p-3 text-left transition-colors ${
                  active ? "border-primary bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <span className="text-sm font-medium">{f.base}</span>
                {Number(target.price) > 0 && (
                  <span className="text-xs text-gold font-semibold">
                    +${Number(target.price).toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(() => {
          const entry = flavors.find((f) => f.base === selectedBase);
          if (!entry || !entry.regular || !entry.sf) return null;
          return (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {entry.base}:
              </span>
              {[entry.regular, entry.sf].map((a) => {
                const checked = selectedId === a!.id;
                return (
                  <button
                    key={a!.id}
                    type="button"
                    onClick={() => selectSingle(g.name, a!.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {isSugarFree(a!.name) ? "Sugar-Free" : "Regular"}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderDefaultSingle = (g: AddonGroup) => (
    <RadioGroup
      value={singleSelections[g.name] || ""}
      onValueChange={(v) => selectSingle(g.name, v)}
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
              checked ? "border-primary bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
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
  );

  const renderMulti = (g: AddonGroup) => (
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
  );

  const renderGroup = (g: AddonGroup) => {
    if (g.name === "Temperature" && g.type === "single") return renderTemperature(g);
    if (g.name === "Sweetness" && g.type === "single") return renderSweetness(g);
    if (g.name === "Syrup" && g.type === "single") return renderSyrup(g);
    return g.type === "single" ? renderDefaultSingle(g) : renderMulti(g);
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
                {renderGroup(g)}
              </div>
            ))
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold tracking-wide uppercase">
              Special instructions
            </h4>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={3}
              placeholder="e.g. no foam, oat milk allergy, extra hot"
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] leading-snug text-muted-foreground">
                {SPECIAL_INSTRUCTIONS_DISCLAIMER}
              </p>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {note.length}/200
              </span>
            </div>
          </div>
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
