import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EventImageUploader } from "@/components/eventsportal/EventImageUploader";
import { useAllCollections, useSaveEvent, slugify, type StaffEvent } from "@/hooks/useEventsPortal";
import { CLUB_TZ } from "@/lib/rituals";

const ELIGIBILITY = [
  ["public", "Open to the public"],
  ["all_members", "All members"],
  ["founding_only", "Founding Members only"],
  ["diamond_only", "Diamond Members only"],
  ["diamond_founding", "Diamond & Founding Members"],
  ["selected_tiers", "Selected membership tiers"],
  ["invitation_only", "By invitation only"],
] as const;

const VISIBILITY = [
  ["public", "Publicly promoted"],
  ["members", "Visible after sign-in"],
  ["eligible_only", "Visible only to eligible members"],
  ["invitation", "Invitation only"],
] as const;

const STATUS = [
  ["draft", "Draft"],
  ["on_sale", "On sale"],
  ["sold_out", "Sold out"],
] as const;

type Form = {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  details: string;
  what_to_bring: string;
  facilitator: string;
  venue: string;
  image_url: string | null;
  date: string;
  time: string;
  duration_minutes: string;
  is_ritual: boolean;
  collection_id: string;
  eligibility: string;
  eligible_tiers: string;
  visibility: string;
  capacity: string;
  waitlist_enabled: boolean;
  hide_capacity: boolean;
  allow_guest_requests: boolean;
  early_access_starts_at: string;
  general_access_starts_at: string;
  is_included: boolean;
  member_price: string;
  non_member_price: string;
  cancellation_policy: string;
  status: string;
};

const localInput = (iso: string | null) =>
  iso ? formatInTimeZone(new Date(iso), CLUB_TZ, "yyyy-MM-dd'T'HH:mm") : "";

const emptyForm = (): Form => ({
  title: "",
  slug: "",
  subtitle: "",
  description: "",
  details: "",
  what_to_bring: "",
  facilitator: "",
  venue: "Storm Wellness Club",
  image_url: null,
  date: "",
  time: "18:00",
  duration_minutes: "90",
  is_ritual: true,
  collection_id: "none",
  eligibility: "all_members",
  eligible_tiers: "",
  visibility: "public",
  capacity: "20",
  waitlist_enabled: true,
  hide_capacity: true,
  allow_guest_requests: false,
  early_access_starts_at: "",
  general_access_starts_at: "",
  is_included: true,
  member_price: "0",
  non_member_price: "0",
  cancellation_policy:
    "Please release your place at least 24 hours before the gathering so another member may join us.",
  status: "draft",
});

const fromEvent = (e: StaffEvent, duplicate: boolean): Form => {
  const zoned = toZonedTime(new Date(e.starts_at), CLUB_TZ);
  return {
    title: duplicate ? `${e.title} (copy)` : e.title,
    slug: duplicate ? "" : e.slug,
    subtitle: e.subtitle ?? "",
    description: e.description ?? "",
    details: e.details ?? "",
    what_to_bring: e.what_to_bring ?? "",
    facilitator: e.facilitator ?? "",
    venue: e.venue ?? "Storm Wellness Club",
    image_url: e.image_url,
    date: duplicate ? "" : formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "yyyy-MM-dd"),
    time: formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "HH:mm"),
    duration_minutes: String(e.duration_minutes ?? 90),
    is_ritual: !!e.is_ritual,
    collection_id: e.collection_id ?? "none",
    eligibility: e.eligibility ?? (e.members_only ? "all_members" : "public"),
    eligible_tiers: (e.eligible_tiers ?? []).join(", "),
    visibility: e.visibility ?? "public",
    capacity: e.capacity != null ? String(e.capacity) : "",
    waitlist_enabled: e.waitlist_enabled !== false,
    hide_capacity: e.hide_capacity !== false,
    allow_guest_requests: !!e.allow_guest_requests,
    early_access_starts_at: duplicate ? "" : localInput(e.early_access_starts_at),
    general_access_starts_at: duplicate ? "" : localInput(e.general_access_starts_at),
    is_included: !!e.is_included,
    member_price: ((e.member_price_cents ?? 0) / 100).toString(),
    non_member_price: ((e.non_member_price_cents ?? 0) / 100).toString(),
    cancellation_policy: e.cancellation_policy ?? "",
    status: duplicate ? "draft" : (e.status ?? "draft"),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  };
};

export function EventEditorDialog({
  open,
  onOpenChange,
  event,
  duplicate = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event?: StaffEvent | null;
  duplicate?: boolean;
  onSaved?: (slug: string) => void;
}) {
  const { data: collections = [] } = useAllCollections();
  const save = useSaveEvent();
  const [form, setForm] = useState<Form>(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm(event ? fromEvent(event, duplicate) : emptyForm());
  }, [open, event, duplicate]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const slug = useMemo(
    () => (form.slug ? slugify(form.slug) : slugify(form.title)),
    [form.slug, form.title],
  );

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Give the event a title.");
    if (!form.date) return toast.error("Choose a date.");
    const startsAt = fromZonedTime(`${form.date}T${form.time || "18:00"}:00`, CLUB_TZ);
    const membersOnly = form.eligibility !== "public";

    const values: Record<string, any> = {
      title: form.title.trim(),
      slug,
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      details: form.details.trim() || null,
      what_to_bring: form.what_to_bring.trim() || null,
      facilitator: form.facilitator.trim() || null,
      venue: form.venue.trim() || null,
      image_url: form.image_url,
      starts_at: startsAt.toISOString(),
      duration_minutes: Number(form.duration_minutes) || 90,
      is_ritual: form.is_ritual,
      collection_id: form.is_ritual && form.collection_id !== "none" ? form.collection_id : null,
      eligibility: form.eligibility,
      eligible_tiers:
        form.eligibility === "selected_tiers"
          ? form.eligible_tiers
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
          : null,
      members_only: membersOnly,
      visibility: form.visibility,
      capacity: form.capacity ? Number(form.capacity) : null,
      waitlist_enabled: form.waitlist_enabled,
      hide_capacity: form.hide_capacity,
      allow_guest_requests: form.allow_guest_requests,
      early_access_starts_at: form.early_access_starts_at
        ? fromZonedTime(form.early_access_starts_at, CLUB_TZ).toISOString()
        : null,
      general_access_starts_at: form.general_access_starts_at
        ? fromZonedTime(form.general_access_starts_at, CLUB_TZ).toISOString()
        : null,
      is_included: form.is_included,
      member_price_cents: form.is_included ? 0 : Math.round(Number(form.member_price || 0) * 100),
      non_member_price_cents: Math.round(Number(form.non_member_price || 0) * 100),
      cancellation_policy: form.cancellation_policy.trim() || null,
      status: form.status,
    };

    try {
      await save.mutateAsync({ id: duplicate ? undefined : event?.id, values });
      toast.success(event && !duplicate ? "Event updated." : "Event created.");
      onOpenChange(false);
      onSaved?.(slug);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("duplicate")
          ? "Another event already uses that web address — change the title or address."
          : (e?.message ?? "That could not be saved."),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {duplicate ? "Duplicate event" : event ? "Edit event" : "Create an event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* The event */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-primary">The event</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Subtitle</Label>
                <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Web address</Label>
              <Input
                value={form.slug}
                placeholder={slug || "auto from the title"}
                onChange={(e) => set("slug", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">storm.../events/{slug || "…"}</p>
            </div>
            <div className="space-y-1.5">
              <Label>The write-up</Label>
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>What to expect</Label>
                <Textarea
                  rows={4}
                  value={form.details}
                  onChange={(e) => set("details", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>What to bring (one per line)</Label>
                <Textarea
                  rows={4}
                  value={form.what_to_bring}
                  onChange={(e) => set("what_to_bring", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Facilitator or featured guest</Label>
                <Input
                  value={form.facilitator}
                  onChange={(e) => set("facilitator", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} />
              </div>
            </div>
            <EventImageUploader value={form.image_url} onChange={(v) => set("image_url", v)} />
          </section>

          <Separator />

          {/* When */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-primary">When (Detroit time)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Length (minutes)</Label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => set("duration_minutes", e.target.value)}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Kind & who */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-primary">Kind & audience</h3>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Member Ritual</Label>
                <p className="text-xs text-muted-foreground">
                  Off means this is a public experience.
                </p>
              </div>
              <Switch
                checked={form.is_ritual}
                onCheckedChange={(v) => set("is_ritual", v)}
              />
            </div>
            {form.is_ritual && (
              <div className="space-y-1.5">
                <Label>Collection</Label>
                <Select
                  value={form.collection_id}
                  onValueChange={(v) => set("collection_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No collection</SelectItem>
                    {collections.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Who it's for</Label>
                <Select value={form.eligibility} onValueChange={(v) => set("eligibility", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELIGIBILITY.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Who can see it</Label>
                <Select value={form.visibility} onValueChange={(v) => set("visibility", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.eligibility === "selected_tiers" && (
              <div className="space-y-1.5">
                <Label>Tiers (comma separated, e.g. diamond, platinum)</Label>
                <Input
                  value={form.eligible_tiers}
                  onChange={(e) => set("eligible_tiers", e.target.value)}
                />
              </div>
            )}
          </section>

          <Separator />

          {/* Reservations */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-primary">Reservations</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Early access opens (priority booking)</Label>
                <Input
                  type="datetime-local"
                  value={form.early_access_starts_at}
                  onChange={(e) => set("early_access_starts_at", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>General access opens</Label>
                <Input
                  type="datetime-local"
                  value={form.general_access_starts_at}
                  onChange={(e) => set("general_access_starts_at", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              {(
                [
                  ["waitlist_enabled", "Offer a waitlist once it fills"],
                  ["hide_capacity", "Hide remaining places from members"],
                  ["allow_guest_requests", "Members may request a place for a guest"],
                ] as [keyof Form, string][]
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="font-normal">{label}</Label>
                  <Switch
                    checked={form[key] as boolean}
                    onCheckedChange={(v) => set(key, v as any)}
                  />
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Cost */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-primary">Cost</h3>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="font-normal">Included with membership</Label>
              <Switch checked={form.is_included} onCheckedChange={(v) => set("is_included", v)} />
            </div>
            {!form.is_included && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Member price ($)</Label>
                  <Input
                    type="number"
                    value={form.member_price}
                    onChange={(e) => set("member_price", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Non-member price ($)</Label>
                  <Input
                    type="number"
                    value={form.non_member_price}
                    onChange={(e) => set("non_member_price", e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Cancellation policy</Label>
              <Textarea
                rows={2}
                value={form.cancellation_policy}
                onChange={(e) => set("cancellation_policy", e.target.value)}
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {duplicate ? "Create copy" : event ? "Save changes" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
