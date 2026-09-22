import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import { PTShell, PTPageHeader, PTCard, PTSectionTitle, PTBadge, PTModal, ptButtonClass } from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PT_FORMAT_LABEL, PT_FORMATS, PtFormat, formatCents } from "@/lib/ptFormat";
import {
  usePTPackPaymentPlans, usePTPackPaymentPlanMutations, PTPackPaymentPlan,
  PlanFrequency, FREQUENCY_LABEL, evenSplit, planTotalCents,
} from "@/hooks/pt/usePTPackPaymentPlans";

interface PackDraft {
  format: PtFormat;
  name: string;
  sessions: number;
  price_dollars: number;
  expiration_days: number;
  is_public: boolean;
  is_active: boolean;
  display_order: number;
  notes: string;
}

const EMPTY: PackDraft = {
  format: "one_on_one",
  name: "",
  sessions: 1,
  price_dollars: 0,
  expiration_days: 30,
  is_public: true,
  is_active: true,
  display_order: 10,
  notes: "",
};

export default function PTPackageEdit() {
  const { packId } = useParams<{ packId: string }>();
  const isNew = !packId || packId === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<PackDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [planEditing, setPlanEditing] = useState<Partial<PTPackPaymentPlan> | null>(null);

  const { data: pack, isLoading } = useQuery({
    queryKey: ["pt-pack", packId],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_packs").select("*").eq("id", packId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!pack) return;
    setDraft({
      format: pack.format,
      name: pack.name,
      sessions: pack.sessions,
      price_dollars: (pack.price_cents ?? 0) / 100,
      expiration_days: pack.expiration_days,
      is_public: pack.is_public,
      is_active: pack.is_active,
      display_order: pack.display_order,
      notes: pack.notes ?? "",
    });
  }, [pack?.id]);

  const priceCents = Math.round(draft.price_dollars * 100);
  const { data: plans = [], isLoading: plansLoading } = usePTPackPaymentPlans(isNew ? undefined : packId);
  const packPlans = useMemo(
    () => (isNew ? [] : plans.filter((p) => p.pack_id === packId)),
    [plans, packId, isNew],
  );
  const { save: savePlan, duplicate, setActive } = usePTPackPaymentPlanMutations(packId);

  async function savePack() {
    if (!draft.name.trim()) return toast.error("Name required");
    if (draft.sessions < 1) return toast.error("Sessions must be at least 1");
    if (draft.expiration_days < 1) return toast.error("Expiration must be at least 1 day");

    setSaving(true);
    try {
      const payload = {
        format: draft.format,
        name: draft.name.trim(),
        sessions: draft.sessions,
        price_cents: priceCents,
        expiration_days: draft.expiration_days,
        is_public: draft.is_public,
        is_active: draft.is_active,
        display_order: draft.display_order,
        notes: draft.notes.trim() || null,
      };
      if (isNew) {
        const { data, error } = await (supabase as any)
          .from("pt_packs").insert(payload).select("id").single();
        if (error) throw error;
        toast.success("Package created — add its payment plans below");
        qc.invalidateQueries({ queryKey: ["pt-packages-catalog-v2"] });
        qc.invalidateQueries({ queryKey: ["pt-packs-all"] });
        navigate(`/admin/pt/packages/${data.id}`, { replace: true });
      } else {
        const { error } = await (supabase as any).from("pt_packs").update(payload).eq("id", packId);
        if (error) throw error;
        toast.success("Package saved");
        qc.invalidateQueries({ queryKey: ["pt-pack", packId] });
        qc.invalidateQueries({ queryKey: ["pt-packages-catalog-v2"] });
        qc.invalidateQueries({ queryKey: ["pt-packs-all"] });
        qc.invalidateQueries({ queryKey: ["pt-packs-admin"] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Personal Training / Packages"
        title={isNew ? "New package" : draft.name || "Package"}
        subtitle="Pricing, expiration and every payment option offered at the point of sale."
        actions={
          <>
            <button className={ptButtonClass("outline")} onClick={() => navigate("/admin/pt/packages")}>
              Back to packages
            </button>
            <button className={ptButtonClass("primary")} onClick={savePack} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save package
            </button>
          </>
        }
      />

      {!isNew && isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          <PTCard>
            <PTSectionTitle>Package details</PTSectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. 24 Session Personal Training"
                  className="border-pt-line bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v as PtFormat })}>
                  <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PT_FORMATS.map((f) => <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <div className="space-y-1">
                  <Label>Sessions</Label>
                  <Input type="number" min={1} value={draft.sessions}
                    onChange={(e) => setDraft({ ...draft, sessions: parseInt(e.target.value || "1", 10) })}
                    className="border-pt-line bg-white" />
                </div>
                <div className="space-y-1">
                  <Label>Package price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={draft.price_dollars}
                    onChange={(e) => setDraft({ ...draft, price_dollars: parseFloat(e.target.value || "0") })}
                    className="border-pt-line bg-white" />
                </div>
                <div className="space-y-1">
                  <Label>Expiration (days)</Label>
                  <Input type="number" min={1} value={draft.expiration_days}
                    onChange={(e) => setDraft({ ...draft, expiration_days: parseInt(e.target.value || "1", 10) })}
                    className="border-pt-line bg-white" />
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Internal notes</Label>
                <Textarea rows={2} value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  className="border-pt-line bg-white" />
              </div>
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <ToggleRow label="Active" hint="Available everywhere"
                  checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
                <ToggleRow label="Public" hint="Shown on the website"
                  checked={draft.is_public} onChange={(v) => setDraft({ ...draft, is_public: v })} />
                <div className="space-y-1">
                  <Label>Display order</Label>
                  <Input type="number" value={draft.display_order}
                    onChange={(e) => setDraft({ ...draft, display_order: parseInt(e.target.value || "0", 10) })}
                    className="border-pt-line bg-white" />
                </div>
              </div>
            </div>
          </PTCard>

          <PTCard>
            <PTSectionTitle>Payment options</PTSectionTitle>
            {isNew ? (
              <p className="text-sm text-pt-muted">Save the package first, then add its payment plans.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-pt-line px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-pt-gold" />
                    <div>
                      <div className="text-sm font-medium">Pay in full</div>
                      <div className="text-xs text-pt-muted">{formatCents(priceCents)} at checkout</div>
                    </div>
                  </div>
                  <PTBadge tone="green">Active</PTBadge>
                </div>

                {plansLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : packPlans.length === 0 ? (
                  <p className="text-sm text-pt-muted">No payment plans yet.</p>
                ) : (
                  packPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onEdit={() => setPlanEditing(plan)}
                      onDuplicate={() => duplicate.mutate(plan)}
                      onToggle={() => setActive.mutate({ id: plan.id, is_active: !plan.is_active })}
                    />
                  ))
                )}

                <button
                  className={ptButtonClass("outline")}
                  onClick={() =>
                    setPlanEditing({
                      pack_id: packId,
                      name: "",
                      installment_count: 4,
                      frequency: "monthly",
                      is_active: true,
                      display_order: (packPlans.at(-1)?.display_order ?? 0) + 10,
                      ...evenSplit(priceCents, 4),
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Add payment plan
                </button>
              </div>
            )}
          </PTCard>
        </div>
      )}

      <PlanDialog
        plan={planEditing}
        priceCents={priceCents}
        onClose={() => setPlanEditing(null)}
        onSave={async (d) => {
          await savePlan.mutateAsync({
            id: d.id,
            pack_id: packId!,
            name: d.name!,
            installment_count: d.installment_count!,
            down_payment_cents: d.down_payment_cents!,
            installment_cents: d.installment_cents!,
            frequency: d.frequency as PlanFrequency,
            is_active: d.is_active ?? true,
            display_order: d.display_order ?? 10,
          });
          setPlanEditing(null);
        }}
        pending={savePlan.isPending}
      />
    </PTShell>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-pt-line px-3 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-pt-muted">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PlanCard({ plan, onEdit, onDuplicate, onToggle }: {
  plan: PTPackPaymentPlan;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
}) {
  const rows: [string, string][] = [
    ["Plan total", formatCents(planTotalCents(plan))],
    ["Due at sale", formatCents(plan.down_payment_cents)],
    ["Future installments", `${plan.installment_count - 1} × ${formatCents(plan.installment_cents)}`],
    ["Frequency", FREQUENCY_LABEL[plan.frequency]],
    ["First autopay date", "Chosen when package is sold"],
    ["Automatic charge", "Yes"],
    ["Saved card required", "Yes"],
  ];
  return (
    <div className="rounded-lg border border-pt-line">
      <div className="flex items-center justify-between px-4 py-3 border-b border-pt-line">
        <div className="text-sm font-medium">{plan.name}</div>
        <PTBadge tone={plan.is_active ? "green" : "neutral"}>{plan.is_active ? "Active" : "Archived"}</PTBadge>
      </div>
      <dl className="px-4 py-3 space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-pt-muted">{k}</dt>
            <dd className="font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="px-4 py-2 border-t border-pt-line flex justify-end gap-3 text-xs">
        <button className="text-pt-muted hover:text-pt-gold" onClick={onEdit}>Edit</button>
        <button className="text-pt-muted hover:text-pt-gold" onClick={onDuplicate}>Duplicate</button>
        <button className="text-pt-muted hover:text-pt-gold" onClick={onToggle}>
          {plan.is_active ? "Archive" : "Reactivate"}
        </button>
      </div>
    </div>
  );
}

function PlanDialog({ plan, priceCents, onClose, onSave, pending }: {
  plan: Partial<PTPackPaymentPlan> | null;
  priceCents: number;
  onClose: () => void;
  onSave: (d: Partial<PTPackPaymentPlan>) => Promise<void>;
  pending: boolean;
}) {
  const [draft, setDraft] = useState<Partial<PTPackPaymentPlan>>({});
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (plan) { setDraft(plan); setManual(false); }
  }, [plan?.id, plan?.pack_id, (plan as any)?.name]);

  const count = draft.installment_count ?? 4;
  const down = draft.down_payment_cents ?? 0;
  const inst = draft.installment_cents ?? 0;
  const total = down + (count - 1) * inst;
  const balanced = total === priceCents;

  function applyCount(n: number) {
    const c = Math.min(24, Math.max(2, n || 2));
    if (manual) setDraft({ ...draft, installment_count: c });
    else setDraft({ ...draft, installment_count: c, ...evenSplit(priceCents, c) });
  }

  function applyDown(dollars: number) {
    const d = Math.max(0, Math.round(dollars * 100));
    const remaining = Math.max(0, priceCents - d);
    const each = count > 1 ? Math.round(remaining / (count - 1)) : 0;
    setDraft({ ...draft, down_payment_cents: d, installment_cents: manual ? inst : each });
  }

  return (
    <PTModal
      open={!!plan}
      onOpenChange={(v) => !v && onClose()}
      title={plan?.id ? "Edit payment plan" : "Add payment plan"}
      description="Every plan must add up to the package price."
      size="sm"
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={!draft.name?.trim() || !balanced || pending}
            onClick={() => onSave(draft)}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save plan
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Plan name</Label>
          <Input
            value={draft.name ?? ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. 4 Monthly Payments"
            className="border-pt-line bg-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Number of payments</Label>
            <Input type="number" min={2} max={24} value={count}
              onChange={(e) => applyCount(parseInt(e.target.value || "2", 10))}
              className="border-pt-line bg-white" />
          </div>
          <div className="space-y-1">
            <Label>Frequency</Label>
            <Select value={(draft.frequency as string) ?? "monthly"}
              onValueChange={(v) => setDraft({ ...draft, frequency: v as PlanFrequency })}>
              <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABEL) as PlanFrequency[]).map((f) => (
                  <SelectItem key={f} value={f}>{FREQUENCY_LABEL[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Due at sale ($)</Label>
            <Input type="number" min={0} step="0.01" value={(down / 100).toFixed(2)}
              onChange={(e) => applyDown(parseFloat(e.target.value || "0"))}
              className="border-pt-line bg-white" />
          </div>
          <div className="space-y-1">
            <Label>Each installment ($)</Label>
            <Input type="number" min={0} step="0.01" value={(inst / 100).toFixed(2)}
              disabled={!manual}
              onChange={(e) => setDraft({ ...draft, installment_cents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100)) })}
              className="border-pt-line bg-white" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
          Set the installment amount manually
        </label>

        <div className="flex items-center justify-between rounded-lg border border-pt-line px-3 py-2">
          <div>
            <div className="text-sm font-medium">Active</div>
            <div className="text-xs text-pt-muted">Offered when the package is sold</div>
          </div>
          <Switch checked={draft.is_active ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
        </div>

        <div className={`rounded-lg px-3 py-2 text-sm ${balanced ? "bg-pt-cream/40 border border-pt-line" : "bg-destructive/10 border border-destructive/40 text-destructive"}`}>
          Plan total {formatCents(total)} · Due at sale {formatCents(down)} · {count - 1} × {formatCents(inst)}
          {!balanced && <div className="text-xs mt-1">Must equal the package price of {formatCents(priceCents)}.</div>}
        </div>
      </div>
    </PTModal>
  );
}
