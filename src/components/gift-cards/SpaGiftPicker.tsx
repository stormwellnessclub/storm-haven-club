import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type SpaGiftService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  price: number;
};

export const TIP_PERCENTS = [0, 15, 18, 20] as const;

export function useGiftableSpaServices() {
  return useQuery({
    queryKey: ["giftable-spa-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_services")
        .select("id, name, description, category, duration_minutes, price")
        .eq("is_active", true)
        .gt("price", 0)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpaGiftService[];
    },
  });
}

/** Service tiles for spa gift cards. */
export function SpaServiceGrid({
  selectedId,
  onSelect,
  compact,
}: {
  selectedId: string | null;
  onSelect: (s: SpaGiftService) => void;
  compact?: boolean;
}) {
  const { data: services = [], isLoading } = useGiftableSpaServices();
  if (isLoading) {
    return (
      <div className="flex justify-center p-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">No spa services are available to gift right now.</p>;
  }
  return (
    <div className={cn("grid gap-2", compact ? "max-h-64 overflow-y-auto sm:grid-cols-2" : "sm:grid-cols-2")}>
      {services.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors",
            selectedId === s.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
          )}
        >
          <div className="text-sm font-medium">{s.name}</div>
          <div className="text-xs text-muted-foreground">
            {[s.duration_minutes ? `${s.duration_minutes} min` : null, s.category].filter(Boolean).join(" · ")}
          </div>
          <div className="mt-1 font-semibold">${Number(s.price).toFixed(2)}</div>
        </button>
      ))}
    </div>
  );
}

/** Optional pre-paid therapist gratuity. */
export function TherapistTipPicker({
  baseCents,
  tipCents,
  onChange,
}: {
  baseCents: number;
  tipCents: number;
  onChange: (cents: number) => void;
}) {
  const pctCents = (p: number) => Math.round((baseCents * p) / 100);
  const matchedPct = TIP_PERCENTS.find((p) => pctCents(p) === tipCents);
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div>
        <div className="text-sm font-medium">Add a tip for the therapist?</div>
        <div className="text-xs text-muted-foreground">
          Optional. The tip is paid now, so the person you're gifting won't need to tip after their visit.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TIP_PERCENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(pctCents(p))}
            className={cn(
              "rounded-md border px-3 py-2 text-sm transition-colors",
              matchedPct === p ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50",
            )}
          >
            {p === 0 ? "No tip" : `${p}% · $${(pctCents(p) / 100).toFixed(2)}`}
          </button>
        ))}
      </div>
      <div className="max-w-[180px]">
        <Label className="text-xs text-muted-foreground">Custom tip ($)</Label>
        <Input
          type="number"
          min={0}
          step={1}
          value={matchedPct === undefined ? (tipCents / 100).toString() : ""}
          placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0);
          }}
        />
      </div>
    </div>
  );
}
