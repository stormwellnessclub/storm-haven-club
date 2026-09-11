import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Archive, Mail, Phone } from "lucide-react";
import { formatEventDate } from "@/lib/privateEvents";
import type { PrivateEventRequest } from "@/hooks/usePrivateEvents";
import { usePrivateEventMutations } from "@/hooks/usePrivateEvents";

export function PrivateEventRequestsInbox({
  requests,
  onOpenEvent,
}: {
  requests: PrivateEventRequest[];
  onOpenEvent: (eventId: string) => void;
}) {
  const { createEvent, updateRequest } = usePrivateEventMutations();

  const convert = async (r: PrivateEventRequest) => {
    const created = await createEvent.mutateAsync({
      request_id: r.id,
      title: `${r.event_type ?? "Private event"} — ${r.first_name} ${r.last_name}`,
      event_type: r.event_type,
      client_first_name: r.first_name,
      client_last_name: r.last_name,
      client_email: r.email,
      client_phone: r.phone,
      event_date: r.preferred_date,
      guest_count: r.guest_count,
      spaces: r.spaces ?? [],
      stage: "inquiry",
      internal_notes: r.notes,
    } as any);
    updateRequest.mutate({ id: r.id, status: "converted", converted_event_id: created.id });
    onOpenEvent(created.id);
  };

  if (requests.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No requests yet.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <Card key={r.id} className={r.status === "new" ? "border-primary/40" : ""}>
          <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.first_name} {r.last_name}</span>
                {r.status === "new" && <Badge>New</Badge>}
                {r.status === "converted" && <Badge variant="secondary">Converted</Badge>}
                {r.status === "archived" && <Badge variant="outline">Archived</Badge>}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>
                {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
              </div>
              <div className="text-sm">
                {r.event_type ?? "Event"} · {formatEventDate(r.preferred_date)}
                {r.preferred_time ? ` · ${r.preferred_time}` : ""}
                {r.guest_count ? ` · ${r.guest_count} guests` : ""}
              </div>
              {r.spaces?.length > 0 && (
                <div className="text-xs text-muted-foreground">Spaces: {r.spaces.join(", ")}</div>
              )}
              {r.budget_range && <div className="text-xs text-muted-foreground">Budget: {r.budget_range}</div>}
              {r.notes && <p className="max-w-xl text-sm text-muted-foreground">{r.notes}</p>}
              <div className="text-xs text-muted-foreground">
                Received {new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {r.status !== "converted" ? (
                <Button size="sm" onClick={() => convert(r)} disabled={createEvent.isPending}>
                  Start planning <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                r.converted_event_id && (
                  <Button size="sm" variant="outline" onClick={() => onOpenEvent(r.converted_event_id!)}>
                    Open event
                  </Button>
                )
              )}
              {r.status === "new" && (
                <Button size="sm" variant="ghost" onClick={() => updateRequest.mutate({ id: r.id, status: "archived" })}>
                  <Archive className="mr-1 h-4 w-4" /> Archive
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
