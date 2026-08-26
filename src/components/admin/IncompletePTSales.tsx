import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format as fmtDate, parseISO } from "date-fns";
import { formatCents } from "@/lib/ptFormat";

interface SaleIntent {
  id: string;
  idempotency_key: string;
  user_id: string;
  pack_name: string;
  quantity: number;
  sessions_per_pack: number;
  unit_price_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  amount_charged_cents: number | null;
  finalize_error: string | null;
  created_at: string;
}

/**
 * Phase 2A recovery surface: a PT sale whose payment was recorded but whose
 * package was never created stays visible here until staff finalize it.
 * Retrying uses the same sale reference, so the customer is never charged twice.
 */
export function IncompletePTSales() {
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: sales = [] } = useQuery({
    queryKey: ["pt-sale-intents", "incomplete"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<SaleIntent[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_sale_intents")
        .select(
          "id, idempotency_key, user_id, pack_name, quantity, sessions_per_pack, unit_price_cents, status, stripe_payment_intent_id, amount_charged_cents, finalize_error, created_at",
        )
        .neq("status", "finalized")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as SaleIntent[];
    },
  });

  // Only surface sales that actually need staff attention: money was taken, or
  // the sale recorded an error. A freshly opened "pending" sale is normal.
  const needsAttention = sales.filter(
    (s) => s.status === "paid" || !!s.stripe_payment_intent_id || !!s.finalize_error,
  );

  if (needsAttention.length === 0) return null;

  async function retry(sale: SaleIntent) {
    setRetryingId(sale.id);
    try {
      const { error } = await (supabase as any).rpc("pt_finalize_package_sale", {
        p_idempotency_key: sale.idempotency_key,
      });
      if (error) throw error;
      toast.success(`Package created for ${sale.pack_name}`);
      qc.invalidateQueries({ queryKey: ["pt-sale-intents"] });
      qc.invalidateQueries({ queryKey: ["pt-passes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not finalize the sale");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h2 className="text-sm font-semibold">Incomplete PT sales</h2>
        <Badge variant="destructive">{needsAttention.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Payment was recorded but the package was not created. Retrying is safe — the customer will not be
        charged again.
      </p>
      <div className="space-y-2">
        {needsAttention.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium">
                {s.quantity} × {s.pack_name}{" "}
                <span className="text-muted-foreground">
                  ({s.sessions_per_pack} sessions each · {formatCents(s.amount_charged_cents ?? s.unit_price_cents)})
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {fmtDate(parseISO(s.created_at), "MMM d, h:mm a")} · ref {s.idempotency_key.slice(0, 8)}
                {s.stripe_payment_intent_id ? ` · ${s.stripe_payment_intent_id}` : ""}
                {s.finalize_error ? ` · ${s.finalize_error}` : ""}
              </div>
            </div>
            <Button size="sm" onClick={() => retry(s)} disabled={retryingId === s.id}>
              {retryingId === s.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Finalize package
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
