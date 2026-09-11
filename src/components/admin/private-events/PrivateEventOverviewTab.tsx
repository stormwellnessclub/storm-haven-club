import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Save } from "lucide-react";
import {
  EVENT_SPACES,
  EVENT_STAGES,
  EVENT_TYPES,
} from "@/lib/privateEvents";
import type { PrivateEvent } from "@/hooks/usePrivateEvents";
import { usePrivateEventConflicts, usePrivateEventMutations } from "@/hooks/usePrivateEvents";

interface Props {
  event: PrivateEvent;
}

export function PrivateEventOverviewTab({ event }: Props) {
  const { updateEvent } = usePrivateEventMutations();
  const [form, setForm] = useState<PrivateEvent>(event);

  useEffect(() => setForm(event), [event.id, event.updated_at]);

  const set = <K extends keyof PrivateEvent>(key: K, value: PrivateEvent[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: conflicts = [] } = usePrivateEventConflicts(
    form.event_date,
    form.start_time,
    form.end_time,
    event.id,
  );

  const toggleSpace = (space: string) => {
    const current = form.spaces ?? [];
    set("spaces", current.includes(space) ? current.filter((s) => s !== space) : [...current, space]);
  };

  const save = () =>
    updateEvent.mutate({
      id: event.id,
      title: form.title,
      event_type: form.event_type,
      client_first_name: form.client_first_name,
      client_last_name: form.client_last_name,
      client_email: form.client_email,
      client_phone: form.client_phone,
      event_date: form.event_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      guest_count: form.guest_count,
      spaces: form.spaces,
      stage: form.stage,
      internal_notes: form.internal_notes,
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Event details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Event name</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div>
            <Label>Type</Label>
            <Select value={form.event_type ?? ""} onValueChange={(v) => set("event_type", v)}>
              <SelectTrigger><SelectValue placeholder="Choose a type" /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date</Label>
            <Input type="date" value={form.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} />
          </div>
          <div>
            <Label>Guests</Label>
            <Input
              type="number"
              min={0}
              value={form.guest_count ?? ""}
              onChange={(e) => set("guest_count", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Start time</Label>
            <Input type="time" value={form.start_time?.slice(0, 5) ?? ""} onChange={(e) => set("start_time", e.target.value)} />
          </div>
          <div>
            <Label>End time</Label>
            <Input type="time" value={form.end_time?.slice(0, 5) ?? ""} onChange={(e) => set("end_time", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label className="mb-2 block">Spaces reserved</Label>
            <div className="flex flex-wrap gap-3">
              {EVENT_SPACES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(form.spaces ?? []).includes(s)} onCheckedChange={() => toggleSpace(s)} />
                  {s}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Once the stage is set to Booked, these spaces are blocked off for the event window.
            </p>
          </div>
        </CardContent>
      </Card>

      {conflicts.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> {conflicts.length} thing(s) already on the calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{c.label}</span>
                <Badge variant="outline">{c.start_time?.slice(0, 5)}–{c.end_time?.slice(0, 5)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Client</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>First name</Label>
            <Input value={form.client_first_name ?? ""} onChange={(e) => set("client_first_name", e.target.value)} />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={form.client_last_name ?? ""} onChange={(e) => set("client_last_name", e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.client_email ?? ""} onChange={(e) => set("client_email", e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.client_phone ?? ""} onChange={(e) => set("client_phone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={form.internal_notes ?? ""}
            onChange={(e) => set("internal_notes", e.target.value)}
            placeholder="Setup, staffing, catering, anything the team should know"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={updateEvent.isPending}>
          <Save className="mr-2 h-4 w-4" /> Save changes
        </Button>
      </div>
    </div>
  );
}
