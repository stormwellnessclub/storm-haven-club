import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Tag, RefreshCcw } from "lucide-react";
import type { ClassPricingRow } from "@/hooks/useClassPassPricing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesPromosTab } from "@/components/admin/promotions/SalesPromosTab";

const CATEGORY_LABEL: Record<string, string> = {
  pilates_cycling: "Pilates & Cycling",
  other: "Other Classes (Sculpt, HIIT, etc.)",
};

const PASS_TYPE_LABEL: Record<string, string> = {
  single: "Single Class",
  "10_pack": "10 Class Pack",
};

const AUDIENCE_LABEL: Record<string, string> = {
  member: "Member",
  non_member: "Non-Member",
};

function PriceRow({ row, onSaved }: { row: ClassPricingRow; onSaved: () => void }) {
  const [dollars, setDollars] = useState<string>((row.price_cents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDollars((row.price_cents / 100).toFixed(2));
  }, [row.price_cents]);

  const dirty = Math.round(parseFloat(dollars || "0") * 100) !== row.price_cents;

  const save = async () => {
    const cents = Math.round(parseFloat(dollars || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      toast.error("Enter a valid dollar amount");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-class-pass-price", {
        body: { id: row.id, price_cents: cents },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Updated ${AUDIENCE_LABEL[row.audience]} ${row.label}`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      <div className="w-40">
        <Badge variant={row.audience === "member" ? "default" : "secondary"}>
          {AUDIENCE_LABEL[row.audience]}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{row.label}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {row.stripe_price_id}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">$</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          className="w-28"
          disabled={saving}
        />
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

export default function ClassPassPricing() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-class-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_pricing")
        .select("id, category, pass_type, audience, label, price_cents, stripe_price_id, is_active")
        .order("category")
        .order("pass_type")
        .order("audience");
      if (error) throw error;
      return (data ?? []) as ClassPricingRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ClassPricingRow[]>();
    (data ?? []).forEach((r) => {
      const key = `${r.category}::${r.pass_type}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [data]);

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-class-pricing"] });
    queryClient.invalidateQueries({ queryKey: ["class-pass-pricing"] });
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Tag className="h-6 w-6" /> Class Passes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage everyday pricing, plus sales and promo codes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="pricing">
          <TabsList>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="sales">Sales &amp; Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="pricing" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Saving creates a new Stripe price automatically — existing purchases are not affected.
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map(([key, rows]) => {
                  const [category, passType] = key.split("::");
                  return (
                    <Card key={key}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {CATEGORY_LABEL[category] ?? category} — {PASS_TYPE_LABEL[passType] ?? passType}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {rows.map((r) => (
                          <PriceRow key={r.id} row={r} onSaved={onSaved} />
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <SalesPromosTab tiers={data ?? []} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

