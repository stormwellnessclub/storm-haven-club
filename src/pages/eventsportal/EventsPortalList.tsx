import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { Plus, Copy, Pencil } from "lucide-react";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useEventsPortalManager } from "@/components/eventsportal/ProtectedEventsPortalRoute";
import { EventEditorDialog } from "@/components/eventsportal/EventEditorDialog";
import { useStaffEvents, useEventStats, type StaffEvent } from "@/hooks/useEventsPortal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLUB_TZ, eligibilityLabel } from "@/lib/rituals";

type Mode = "upcoming" | "rituals" | "public" | "past" | "drafts";

export default function EventsPortalList({ ritualsOnly = false }: { ritualsOnly?: boolean }) {
  const { data: events = [], isLoading } = useStaffEvents();
  const { data: stats = {} } = useEventStats();
  const isManager = useEventsPortalManager();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>(ritualsOnly ? "rituals" : "upcoming");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ event?: StaffEvent; duplicate?: boolean } | null>(null);

  const now = Date.now();
  const list = useMemo(() => {
    let out = events;
    if (ritualsOnly) out = out.filter((e) => e.is_ritual);
    if (mode === "upcoming") out = out.filter((e) => +new Date(e.starts_at) >= now);
    if (mode === "rituals") out = out.filter((e) => e.is_ritual && +new Date(e.starts_at) >= now);
    if (mode === "public") out = out.filter((e) => !e.is_ritual && +new Date(e.starts_at) >= now);
    if (mode === "past") out = out.filter((e) => +new Date(e.starts_at) < now);
    if (mode === "drafts") out = out.filter((e) => e.status === "draft");
    if (search.trim())
      out = out.filter((e) => e.title.toLowerCase().includes(search.trim().toLowerCase()));
    return [...out].sort((a, b) =>
      mode === "past"
        ? +new Date(b.starts_at) - +new Date(a.starts_at)
        : +new Date(a.starts_at) - +new Date(b.starts_at),
    );
  }, [events, mode, search, now, ritualsOnly]);

  return (
    <EventsPortalShell
      title={ritualsOnly ? "Member Rituals" : "All events"}
      description={
        ritualsOnly
          ? "Curated gatherings held for members."
          : "Public experiences and Member Rituals together."
      }
      actions={
        isManager && (
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4 mr-2" />
            Create an event
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            {(ritualsOnly
              ? ([
                  ["rituals", "Upcoming"],
                  ["past", "Past"],
                  ["drafts", "Drafts"],
                ] as [Mode, string][])
              : ([
                  ["upcoming", "Upcoming"],
                  ["rituals", "Rituals"],
                  ["public", "Public"],
                  ["past", "Past"],
                  ["drafts", "Drafts"],
                ] as [Mode, string][])
            ).map(([v, l]) => (
              <TabsTrigger key={v} value={v}>
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && list.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      )}

      <div className="grid gap-3">
        {list.map((e) => {
          const s = stats[e.id];
          return (
            <Card key={e.id}>
              <CardContent className="p-3 flex flex-wrap items-center gap-4">
                <div className="h-16 w-24 rounded-md overflow-hidden bg-muted shrink-0">
                  {e.image_url && (
                    <img src={e.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-[200px] flex-1">
                  <Link
                    to={`/events-portal/events/${e.slug}`}
                    className="font-medium hover:underline"
                  >
                    {e.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "EEE MMM d, yyyy · h:mm a")}
                    {e.venue ? ` · ${e.venue}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {e.is_ritual ? "Ritual" : "Public experience"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {eligibilityLabel(e.eligibility ?? "public", e.eligible_tiers)}
                    </Badge>
                    {e.status !== "on_sale" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {e.status === "draft" ? "Draft" : "Sold out"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div>
                    {s?.held ?? 0}
                    {e.capacity ? ` / ${e.capacity}` : ""} held
                  </div>
                  {isManager && !!s?.revenueCents && (
                    <div className="text-xs text-muted-foreground">
                      ${(s.revenueCents / 100).toFixed(2)}
                    </div>
                  )}
                </div>
                {isManager && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing({ event: e })}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({ event: e, duplicate: true })}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EventEditorDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        event={editing?.event}
        duplicate={editing?.duplicate}
        onSaved={(slug) => navigate(`/events-portal/events/${slug}`)}
      />
    </EventsPortalShell>
  );
}
