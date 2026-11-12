import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCreateSpaTreatmentPackage, useSpaTreatmentPackages, useUpdateSpaTreatmentPackage } from "@/hooks/useSpaTreatmentPackages";
import { formatDollars, packageLabel, perTreatmentCents, type SpaTreatmentPackage } from "@/lib/spaPackages";

const SERVICES: { key: string; label: string }[] = [{ key: "aella-sculpt", label: "Aella Sculpt" }];

type Draft = {
  name: string;
  session_count: string;
  price: string;
  member_price: string;
  expires_after_days: string;
  is_recommended: boolean;
  payment_plan_available: boolean;
  is_active: boolean;
};

const toDraft = (p: SpaTreatmentPackage): Draft => ({
  name: p.name,
  session_count: String(p.session_count),
  price: (p.price_cents / 100).toString(),
  member_price: p.member_price_cents == null ? "" : (p.member_price_cents / 100).toString(),
  expires_after_days: p.expires_after_days == null ? "" : String(p.expires_after_days),
  is_recommended: p.is_recommended,
  payment_plan_available: p.payment_plan_available,
  is_active: p.is_active,
});

const cents = (v: string) => (v.trim() === "" ? null : Math.round(Number(v) * 100));
const intOrNull = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

function fromDraft(d: Draft) {
  const price = cents(d.price);
  const count = intOrNull(d.session_count);
  if (!d.name.trim() || price == null || !Number.isFinite(price) || price < 0 || !count || count < 1) return null;
  return {
    name: d.name.trim(),
    session_count: count,
    price_cents: price,
    member_price_cents: cents(d.member_price),
    expires_after_days: intOrNull(d.expires_after_days),
    is_recommended: d.is_recommended,
    payment_plan_available: d.payment_plan_available,
    is_active: d.is_active,
  };
}

function PackageRow({ p }: { p: SpaTreatmentPackage }) {
  const update = useUpdateSpaTreatmentPackage();
  const [d, setD] = useState<Draft>(toDraft(p));
  useEffect(() => setD(toDraft(p)), [p]);
  const parsed = fromDraft(d);
  const dirty = JSON.stringify(d) !== JSON.stringify(toDraft(p));
  return (
    <tr className="border-t align-middle">
      <td className="py-2 pr-2"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label="Package name" /></td>
      <td className="py-2 pr-2 w-20"><Input inputMode="numeric" value={d.session_count} onChange={(e) => setD({ ...d, session_count: e.target.value })} aria-label="Treatments" /></td>
      <td className="py-2 pr-2 w-28"><Input inputMode="decimal" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} aria-label="Price" /></td>
      <td className="py-2 pr-2 w-28"><Input inputMode="decimal" placeholder="Same" value={d.member_price} onChange={(e) => setD({ ...d, member_price: e.target.value })} aria-label="Member price" /></td>
      <td className="py-2 pr-2 w-28"><Input inputMode="numeric" placeholder="None" value={d.expires_after_days} onChange={(e) => setD({ ...d, expires_after_days: e.target.value })} aria-label="Expires after days" /></td>
      <td className="py-2 pr-2 text-center"><Switch checked={d.is_recommended} onCheckedChange={(v) => setD({ ...d, is_recommended: v })} aria-label="Recommended" /></td>
      <td className="py-2 pr-2 text-center"><Switch checked={d.payment_plan_available} onCheckedChange={(v) => setD({ ...d, payment_plan_available: v })} aria-label="Payment plan" /></td>
      <td className="py-2 pr-2 text-center"><Switch checked={d.is_active} onCheckedChange={(v) => setD({ ...d, is_active: v })} aria-label="Active" /></td>
      <td className="py-2 pr-2 text-xs text-muted-foreground whitespace-nowrap">
        {parsed ? `${formatDollars(perTreatmentCents(parsed))} each` : "Check values"}
      </td>
      <td className="py-2 text-right">
        <Button size="sm" disabled={!dirty || !parsed || update.isPending} onClick={() => parsed && update.mutate({ id: p.id, ...parsed })}>
          Save
        </Button>
      </td>
    </tr>
  );
}

function NewPackageRow({ serviceKey, nextOrder }: { serviceKey: string; nextOrder: number }) {
  const create = useCreateSpaTreatmentPackage();
  const blank: Draft = { name: "", session_count: "", price: "", member_price: "", expires_after_days: "", is_recommended: false, payment_plan_available: false, is_active: true };
  const [d, setD] = useState<Draft>(blank);
  const parsed = fromDraft(d);
  return (
    <tr className="border-t bg-muted/30">
      <td className="py-2 pr-2"><Input placeholder="New package name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></td>
      <td className="py-2 pr-2"><Input inputMode="numeric" placeholder="#" value={d.session_count} onChange={(e) => setD({ ...d, session_count: e.target.value })} /></td>
      <td className="py-2 pr-2"><Input inputMode="decimal" placeholder="$" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} /></td>
      <td className="py-2 pr-2"><Input inputMode="decimal" placeholder="Same" value={d.member_price} onChange={(e) => setD({ ...d, member_price: e.target.value })} /></td>
      <td className="py-2 pr-2"><Input inputMode="numeric" placeholder="None" value={d.expires_after_days} onChange={(e) => setD({ ...d, expires_after_days: e.target.value })} /></td>
      <td colSpan={4} />
      <td className="py-2 text-right">
        <Button size="sm" variant="outline" disabled={!parsed || create.isPending}
          onClick={() => parsed && create.mutate({ service_key: serviceKey, display_order: nextOrder, ...parsed }, { onSuccess: () => setD(blank) })}>
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </td>
    </tr>
  );
}

/** Managers edit single-treatment and series prices here; the public pages read them live. */
export function SpaPackagesTab() {
  const { data = [], isLoading } = useSpaTreatmentPackages();
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Prices for single treatments and treatment series. Leave member price blank to use the regular price; leave
        "expires after" blank for no expiration. Only managers and admins can save changes.
      </p>
      {SERVICES.map((s) => {
        const rows = data.filter((p) => p.service_key === s.key).sort((a, b) => a.display_order - b.display_order);
        return (
          <section key={s.key}>
            <h3 className="mb-2 text-lg font-semibold">{s.label}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Treatments</th>
                    <th className="pb-2 font-medium">Price ($)</th>
                    <th className="pb-2 font-medium">Member ($)</th>
                    <th className="pb-2 font-medium">Expires after (days)</th>
                    <th className="pb-2 font-medium text-center">Recommended</th>
                    <th className="pb-2 font-medium text-center">Payment plan</th>
                    <th className="pb-2 font-medium text-center">Active</th>
                    <th className="pb-2 font-medium">Per treatment</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => <PackageRow key={p.id} p={p} />)}
                  <NewPackageRow serviceKey={s.key} nextOrder={rows.length} />
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Shown to clients as: {rows.filter((r) => r.is_active).map((r) => `${packageLabel(r)} ${formatDollars(r.price_cents)}`).join(" · ") || "nothing yet"}
            </p>
          </section>
        );
      })}
    </div>
  );
}
