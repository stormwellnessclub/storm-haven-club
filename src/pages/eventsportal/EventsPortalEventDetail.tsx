import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Check, Copy, Download, ExternalLink, Pencil, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { EventEditorDialog } from "@/components/eventsportal/EventEditorDialog";
import { AddEventAttendeeDialog } from "@/components/eventsportal/AddEventAttendeeDialog";
import { useEventsPortalManager } from "@/components/eventsportal/ProtectedEventsPortalRoute";
import { EventRequestsPanel } from "@/components/admin/events/EventRequestsPanel";
import { HarvestMoonEmailControls } from "@/components/eventsportal/HarvestMoonEmailControls";
import { useStaffEvent } from "@/hooks/useEventsPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CLUB_TZ, eligibilityLabel, priceLabel } from "@/lib/rituals";

export default function EventsPortalEventDetail() {
  const { slug = "" } = useParams();
  const qc = useQueryClient();
  const { data: event, isLoading } = useStaffEvent(slug);
  const isManager = useEventsPortalManager();
  const [editorOpen, setEditorOpen] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: tickets = [] } = useQuery({
    queryKey: ["events-portal-tickets", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*")
        .eq("event_id", event!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const held = useMemo(
    () => tickets.filter((t: any) => ["paid", "checked_in"].includes(t.status)),
    [tickets],
  );
  const attended = held.filter((t: any) => t.checked_in_at).length;

  const name = (t: any) =>
    [t.attendee_first_name ?? t.buyer_first_name, t.attendee_last_name ?? t.buyer_last_name]
      .filter(Boolean)
      .join(" ") || (t.attendee_email ?? t.buyer_email ?? "Guest");

  const toggleCheckIn = async (t: any) => {
    setBusy(t.id);
    const { error } = await supabase.rpc("frontdesk_event_ticket_check_in", {
      p_ticket_id: t.id,
      p_checked_in: !t.checked_in_at,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["events-portal-tickets", event?.id] });
  };

  const removeAttendee = async (t: any) => {
    const who = name(t);
    const reason = window.prompt(`Remove ${who} from this event?\n\nShort reason:`, "");
    if (reason === null) return;
    setBusy(t.id);
    const { data, error } = await supabase.rpc("admin_remove_event_attendee" as any, {
      _ticket_id: t.id,
      _reason: reason.trim() || null,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    const res = data as { ok?: boolean; reason?: string } | null;
    if (!res?.ok) {
      return toast.error(
        res?.reason === "not_authorized"
          ? "You don't have permission to remove people."
          : "We could not remove them.",
      );
    }
    toast.success(`${who} removed.`);
    qc.invalidateQueries({ queryKey: ["events-portal-tickets", event?.id] });
  };

  const download = () => {
    const rows = [
      ["Name", "Email", "Phone", "Type", "Status", "Checked in"],
      ...held.map((t: any) => [
        name(t),
        t.attendee_email ?? t.buyer_email ?? "",
        t.attendee_phone ?? t.buyer_phone ?? "",
        t.ticket_type ?? "",
        t.status ?? "",
        t.checked_in_at ? formatInTimeZone(new Date(t.checked_in_at), CLUB_TZ, "PPp") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <EventsPortalShell title="Loading…">
        <p className="text-sm text-muted-foreground">One moment.</p>
      </EventsPortalShell>
    );
  }

  if (!event) {
    return (
      <EventsPortalShell title="Not found">
        <p className="text-sm text-muted-foreground">
          That event no longer exists.{" "}
          <Link to="/events-portal/events" className="underline">
            Back to all events
          </Link>
        </p>
      </EventsPortalShell>
    );
  }

  return (
    <EventsPortalShell
      title={event.title}
      description={formatInTimeZone(
        new Date(event.starts_at),
        CLUB_TZ,
        "EEEE, MMMM d, yyyy 'at' h:mm a",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View page
            </a>
          </Button>
          <Button variant="outline" onClick={download}>
            <Download className="h-4 w-4 mr-2" />
            Download list
          </Button>
          {isManager && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDuplicate(true);
                  setEditorOpen(true);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
              <Button
                onClick={() => {
                  setDuplicate(false);
                  setEditorOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{event.is_ritual ? "Member Ritual" : "Public experience"}</Badge>
        <Badge variant="outline">
          {eligibilityLabel(event.eligibility ?? "public", event.eligible_tiers)}
        </Badge>
        <Badge variant="outline">
          {priceLabel({
            is_included: event.is_included,
            member_price_cents: event.member_price_cents,
          } as any)}
        </Badge>
        <Badge variant="secondary">
          {held.length}
          {event.capacity ? ` / ${event.capacity}` : ""} held · {attended} attended
        </Badge>
        {event.status !== "on_sale" && (
          <Badge variant="secondary">{event.status === "draft" ? "Draft" : "Sold out"}</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Reservations</CardTitle>
        </CardHeader>
        <CardContent>
          {held.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has reserved a place yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Checked in</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {held.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{name(t)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.attendee_email ?? t.buyer_email}
                    </TableCell>
                    <TableCell>{t.ticket_type === "member" ? "Member" : "Guest"}</TableCell>
                    <TableCell>
                      {t.checked_in_at
                        ? formatInTimeZone(new Date(t.checked_in_at), CLUB_TZ, "h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={t.checked_in_at ? "ghost" : "outline"}
                        disabled={busy === t.id}
                        onClick={() => toggleCheckIn(t)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t.checked_in_at ? "Undo" : "Check in"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isManager && event.slug === "under-the-harvest-moon" && <HarvestMoonEmailControls />}

      <EventRequestsPanel eventId={event.id} />

      <EventEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        event={event}
        duplicate={duplicate}
      />
    </EventsPortalShell>
  );
}
