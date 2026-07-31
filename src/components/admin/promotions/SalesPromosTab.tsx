import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Percent, Mail, Send, Ban, Pencil } from "lucide-react";
import {
  usePromotions, usePromotionEmailJobs, promotionState, discountLabel,
  type Promotion, type PromotionEmailJob,
} from "@/hooks/usePromotions";
import type { ClassPricingRow } from "@/hooks/useClassPassPricing";

const AUDIENCES = [
  { value: "members_and_nonmembers", label: "Members + non-members" },
  { value: "members", label: "Active members only" },
  { value: "non_members", label: "Non-members only" },
];

const STATE_STYLES: Record<string, string> = {
  live: "bg-emerald-600 text-white",
  scheduled: "bg-blue-600 text-white",
  draft: "bg-muted text-muted-foreground",
  ended: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

const KIND_LABEL: Record<string, string> = {
  launch: "Launch announcement",
  ending_soon: "3 days left",
  last_day: "Last day",
  manual: "One-off email",
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Detroit",
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Create / edit sale
// ---------------------------------------------------------------------------
function SaleDialog({
  open, onOpenChange, tiers, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tiers: ClassPricingRow[];
  existing: Promotion | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(existing?.discount_type ?? "percent");
  const [discountValue, setDiscountValue] = useState(String(existing?.discount_value ?? "15"));
  const [appliesToAll, setAppliesToAll] = useState(existing?.applies_to_all ?? true);
  const [pricingIds, setPricingIds] = useState<string[]>(existing?.pricing_ids ?? []);
  const [startsAt, setStartsAt] = useState(
    existing ? toLocalInput(existing.starts_at) : toLocalInput(new Date().toISOString()),
  );
  const [endsAt, setEndsAt] = useState(
    existing
      ? toLocalInput(existing.ends_at)
      : toLocalInput(new Date(Date.now() + 7 * 86400000).toISOString()),
  );
  const [autoApply, setAutoApply] = useState(existing?.auto_apply ?? true);
  const [promoCode, setPromoCode] = useState(existing?.promo_code ?? "");
  const [maxRedemptions, setMaxRedemptions] = useState(
    existing?.max_redemptions ? String(existing.max_redemptions) : "",
  );
  const [remindLaunch, setRemindLaunch] = useState(existing?.remind_on_launch ?? true);
  const [remind3, setRemind3] = useState(existing?.remind_3_days_before_end ?? true);
  const [remindLast, setRemindLast] = useState(existing?.remind_last_day ?? true);
  const [audience, setAudience] = useState(existing?.default_audience ?? "members_and_nonmembers");
  const [activate, setActivate] = useState((existing?.status ?? "draft") === "active");
  const [saving, setSaving] = useState(false);

  const toggleTier = (id: string) =>
    setPricingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    const value = parseFloat(discountValue);
    if (!name.trim()) return toast.error("Give the sale a name");
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a discount amount");
    if (discountType === "percent" && value > 100) return toast.error("Percent discount can't exceed 100");
    if (!appliesToAll && pricingIds.length === 0) return toast.error("Pick at least one pass");
    if (new Date(endsAt) <= new Date(startsAt)) return toast.error("End date must be after the start date");
    if (!autoApply && !promoCode.trim()) return toast.error("A code-only sale needs a promo code");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        scope_type: "class_pass",
        applies_to_all: appliesToAll,
        pricing_ids: appliesToAll ? [] : pricingIds,
        discount_type: discountType,
        discount_value: value,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        auto_apply: autoApply,
        promo_code: promoCode.trim() ? promoCode.trim().toUpperCase() : null,
        max_redemptions: maxRedemptions.trim() ? parseInt(maxRedemptions, 10) : null,
        remind_on_launch: remindLaunch,
        remind_3_days_before_end: remind3,
        remind_last_day: remindLast,
        default_audience: audience,
        status: activate ? "active" : "draft",
        // discount changed => the cached Stripe coupon must be rebuilt
        stripe_coupon_id: null,
      };

      let promotionId = existing?.id ?? null;
      if (existing) {
        const { error } = await supabase.from("promotions").update(payload as any).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("promotions")
          .insert({ ...payload, created_by: userRes?.user?.id ?? null } as any)
          .select("id")
          .single();
        if (error) throw error;
        promotionId = (data as any).id;
      }

      if (promotionId) {
        await syncReminderJobs(promotionId, {
          name: name.trim(),
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          audience,
          remindLaunch,
          remind3,
          remindLast,
          discountText: discountType === "percent" ? `${value}% off` : `$${value.toFixed(2)} off`,
          promoCode: promoCode.trim() ? promoCode.trim().toUpperCase() : null,
        });
      }

      toast.success(existing ? "Sale updated" : "Sale created");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit sale" : "New class pass sale"}</DialogTitle>
          <DialogDescription>
            Automatic sales show a discounted price on the site. Code-only sales stay hidden
            until someone enters the code at checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2">
            <Label>Sale name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Class Pass Sale" />
          </div>

          <div className="grid gap-2">
            <Label>Internal notes (optional)</Label>
            <Input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Discount type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Dollar amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{discountType === "percent" ? "Percent" : "Dollars"} off</Label>
              <Input
                type="number" min="0" step={discountType === "percent" ? "1" : "0.01"}
                value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Applies to all class passes</Label>
                <p className="text-xs text-muted-foreground">Turn off to pick specific passes</p>
              </div>
              <Switch checked={appliesToAll} onCheckedChange={setAppliesToAll} />
            </div>
            {!appliesToAll && (
              <div className="grid sm:grid-cols-2 gap-2 pt-1">
                {tiers.map((t) => (
                  <label key={t.id} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={pricingIds.includes(t.id)} onCheckedChange={() => toggleTier(t.id)} />
                    <span>
                      {t.label}
                      <span className="block text-xs text-muted-foreground">
                        {t.audience === "member" ? "Member" : "Non-member"} · ${(t.price_cents / 100).toFixed(2)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show the sale price publicly</Label>
                <p className="text-xs text-muted-foreground">
                  Off = discount only applies when a promo code is entered
                </p>
              </div>
              <Switch checked={autoApply} onCheckedChange={setAutoApply} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Promo code (optional)</Label>
                <Input
                  value={promoCode ?? ""} placeholder="SUMMER15"
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="grid gap-2">
                <Label>Max redemptions (optional)</Label>
                <Input type="number" min="1" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email reminders</Label>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={remindLaunch} onCheckedChange={(v) => setRemindLaunch(!!v)} />
                Announce when the sale starts
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={remind3} onCheckedChange={(v) => setRemind3(!!v)} />
                Remind 3 days before it ends
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={remindLast} onCheckedChange={(v) => setRemindLast(!!v)} />
                Remind on the last day
              </label>
            </div>
            <div className="grid gap-2">
              <Label>Send to</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Activate this sale</Label>
              <p className="text-xs text-muted-foreground">Drafts never discount anything</p>
            </div>
            <Switch checked={activate} onCheckedChange={setActivate} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {existing ? "Save changes" : "Create sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rebuilds the pending reminder queue to match the sale's current dates + toggles. */
async function syncReminderJobs(promotionId: string, opts: {
  name: string; startsAt: Date; endsAt: Date; audience: string;
  remindLaunch: boolean; remind3: boolean; remindLast: boolean;
  discountText: string; promoCode: string | null;
}) {
  await supabase.from("promotion_email_jobs").delete().eq("promotion_id", promotionId).eq("status", "pending");

  const codeLine = opts.promoCode ? `\n\nUse code ${opts.promoCode} at checkout.` : "";
  const endsText = opts.endsAt.toLocaleDateString("en-US", {
    timeZone: "America/Detroit", weekday: "long", month: "long", day: "numeric",
  });

  const jobs: Array<Record<string, any>> = [];
  const push = (kind: string, when: Date, subject: string, body: string) => {
    if (when.getTime() < Date.now() - 60_000) return;
    jobs.push({
      promotion_id: promotionId,
      kind, subject, body,
      audience: opts.audience,
      scheduled_for: when.toISOString(),
      status: "pending",
    });
  };

  if (opts.remindLaunch) {
    push("launch", opts.startsAt, `${opts.name} — ${opts.discountText} on class passes`,
      `Our ${opts.name} is here: ${opts.discountText} on class passes through ${endsText}.\n\nStock up on Pilates, cycling and sculpt classes at a better rate.${codeLine}`);
  }
  if (opts.remind3) {
    const when = new Date(opts.endsAt.getTime() - 3 * 86400000);
    push("ending_soon", when, `3 days left — ${opts.discountText} on class passes`,
      `Just a reminder that ${opts.name} ends ${endsText}.\n\nThere's still time to grab your passes at ${opts.discountText}.${codeLine}`);
  }
  if (opts.remindLast) {
    const when = new Date(opts.endsAt);
    when.setHours(9, 0, 0, 0);
    push("last_day", when, `Last day — ${opts.discountText} on class passes`,
      `Today is the final day of ${opts.name}. ${opts.discountText} on class passes ends tonight.${codeLine}`);
  }

  if (jobs.length) {
    const { error } = await supabase.from("promotion_email_jobs").insert(jobs as any);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Email queue for one sale
// ---------------------------------------------------------------------------
function EmailJobsPanel({ promotion }: { promotion: Promotion }) {
  const { data: jobs, isLoading, refetch } = usePromotionEmailJobs(promotion.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [editing, setEditing] = useState<PromotionEmailJob | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const openEditor = (job: PromotionEmailJob) => {
    setEditing(job);
    setDraftSubject(job.subject);
    setDraftBody(job.body);
  };

  const saveDraft = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("promotion_email_jobs")
      .update({ subject: draftSubject, body: draftBody })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Email updated");
    setEditing(null);
    refetch();
  };

  const sendNow = async (job: PromotionEmailJob) => {
    setBusy(job.id);
    try {
      const { data, error } = await supabase.functions.invoke("process-promotion-emails", {
        body: { action: "send", jobId: job.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Sent to ${(data as any).sent} people`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (job: PromotionEmailJob) => {
    if (!testEmail.trim()) return toast.error("Enter a test email address");
    setBusy(job.id);
    try {
      const { data, error } = await supabase.functions.invoke("process-promotion-emails", {
        body: { action: "test", promotionId: promotion.id, testEmail, subject: job.subject, body: job.body },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Test sent to ${testEmail}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setBusy(null);
    }
  };

  const cancelJob = async (job: PromotionEmailJob) => {
    const { error } = await supabase
      .from("promotion_email_jobs")
      .update({ status: "cancelled" })
      .eq("id", job.id);
    if (error) return toast.error(error.message);
    refetch();
  };

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!jobs?.length) {
    return <p className="text-xs text-muted-foreground">No emails scheduled for this sale.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className="h-8 text-xs max-w-[240px]"
          placeholder="test@email.com"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">for test sends</span>
      </div>
      {jobs.map((job) => (
        <div key={job.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{KIND_LABEL[job.kind] ?? job.kind}</Badge>
            <Badge variant={job.status === "sent" ? "default" : "secondary"}>{job.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {job.status === "sent" && job.sent_at
                ? `Sent ${fmt(job.sent_at)} · ${job.sent_count} delivered${job.failed_count ? `, ${job.failed_count} failed` : ""}`
                : `Scheduled ${fmt(job.scheduled_for)}`}
            </span>
          </div>
          <div className="mt-1 font-medium">{job.subject}</div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{job.body}</p>
          {job.error_message && <p className="text-xs text-destructive mt-1">{job.error_message}</p>}
          {job.status === "pending" && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => openEditor(job)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="outline" disabled={busy === job.id} onClick={() => sendTest(job)}>
                <Mail className="h-3.5 w-3.5 mr-1" /> Test
              </Button>
              <Button size="sm" disabled={busy === job.id} onClick={() => sendNow(job)}>
                {busy === job.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Send now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => cancelJob(job)}>Cancel</Button>
            </div>
          )}
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Subject</Label>
              <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea rows={8} value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Blank lines start a new paragraph. The greeting, sale header, promo code and
                "Buy Class Passes" button are added automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveDraft}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------
export function SalesPromosTab({ tiers }: { tiers: ClassPricingRow[] }) {
  const { data: promotions, isLoading, refetch } = usePromotions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const tierLabel = useMemo(() => {
    const map = new Map(tiers.map((t) => [t.id, `${t.label} (${t.audience === "member" ? "Member" : "Non-member"})`]));
    return (id: string) => map.get(id) ?? "Pass";
  }, [tiers]);

  const onSaved = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["live-class-pass-sales"] });
  };

  const setStatus = async (p: Promotion, status: "active" | "draft" | "cancelled") => {
    const { error } = await supabase.from("promotions").update({ status }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(status === "cancelled" ? "Sale cancelled" : status === "active" ? "Sale activated" : "Sale paused");
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Run discounts on class passes, with optional promo codes and automatic reminder emails.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New sale
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !promotions?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No sales yet. Create one to offer discounted class passes.
          </CardContent>
        </Card>
      ) : (
        promotions.map((p) => {
          const state = promotionState(p);
          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Percent className="h-4 w-4" /> {p.name}
                    <Badge className={STATE_STYLES[state]}>{state}</Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    {p.status === "draft" && (
                      <Button size="sm" onClick={() => setStatus(p, "active")}>Activate</Button>
                    )}
                    {p.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(p, "cancelled")}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  <span className="font-medium text-foreground">{discountLabel(p)}</span>
                  <span>{fmt(p.starts_at)} → {fmt(p.ends_at)}</span>
                  <span>{p.auto_apply ? "Shown publicly" : "Code only"}</span>
                  {p.promo_code && <span className="font-mono">{p.promo_code}</span>}
                  <span>
                    {p.redemption_count} redeemed{p.max_redemptions ? ` / ${p.max_redemptions}` : ""}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.applies_to_all
                    ? "Applies to all class passes"
                    : `Applies to: ${(p.pricing_ids ?? []).map(tierLabel).join(", ")}`}
                </div>
                <EmailJobsPanel promotion={p} />
              </CardContent>
            </Card>
          );
        })
      )}

      {dialogOpen && (
        <SaleDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tiers={tiers}
          existing={editing}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
