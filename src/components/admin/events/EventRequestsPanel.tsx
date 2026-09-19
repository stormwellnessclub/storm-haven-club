import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Clock } from "lucide-react";

/** Staff-only guest requests + waitlist management for an event. */
export function EventRequestsPanel({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: requests = [] } = useQuery({
    queryKey: ["admin-event-guest-requests", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_guest_requests")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ["admin-event-waitlist", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_waitlist")
        .select("*")
        .eq("event_id", eventId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-event-guest-requests", eventId] });
    qc.invalidateQueries({ queryKey: ["admin-event-waitlist", eventId] });
    qc.invalidateQueries({ queryKey: ["admin-event-tickets", eventId] });
  };

  const sendEmail = (ticketId: string, kind: "guest_approved" | "waitlist_released") =>
    supabase.functions
      .invoke("send-event-reservation-email", { body: { ticket_id: ticketId, kind } })
      .catch(() => undefined);

  const approve = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("approve_event_guest_request", { _request_id: id });
    setBusyId(null);
    const res = data as { ok?: boolean; reason?: string; ticket_id?: string } | null;
    if (error) return toast.error(error.message);
    if (!res?.ok) {
      return toast.error(res?.reason === "full" ? "The event is full." : "Could not approve.");
    }
    if (res.ticket_id) await sendEmail(res.ticket_id, "guest_approved");
    toast.success("Guest seat confirmed and email sent.");
    refresh();
  };

  const decline = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("decline_event_guest_request", { _request_id: id });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Request declined. No email was sent.");
    refresh();
  };

  const offerSeat = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("offer_event_waitlist_seat", { _waitlist_id: id });
    setBusyId(null);
    const res = data as { ok?: boolean; reason?: string; ticket_id?: string } | null;
    if (error) return toast.error(error.message);
    if (!res?.ok) {
      return toast.error(res?.reason === "full" ? "No seats available yet." : "Could not release a seat.");
    }
    if (res.ticket_id) await sendEmail(res.ticket_id, "waitlist_released");
    toast.success("Seat released and email sent.");
    refresh();
  };

  const pending = requests.filter((r: { status: string }) => r.status === "pending");
  const waiting = waitlist.filter((w: { status: string }) => w.status === "waiting");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Guest seat requests
            <Badge variant="secondary">{pending.length} pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guest requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r: Record<string, string>) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">
                        {r.guest_first_name} {r.guest_last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.guest_email || r.guest_phone || "—"}
                      </div>
                      {r.note && <div className="text-xs text-muted-foreground mt-1">{r.note}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{r.requester_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.requester_email}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "default"
                            : r.status === "declined"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.id}
                            onClick={() => decline(r.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Waitlist
            <Badge variant="secondary">{waiting.length} waiting</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is waiting.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitlist.map((w: Record<string, string>) => (
                  <TableRow key={w.id}>
                    <TableCell>{w.position}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {w.first_name} {w.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{w.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.status === "waiting" ? "secondary" : "default"}>
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {w.status === "waiting" && (
                        <Button size="sm" disabled={busyId === w.id} onClick={() => offerSeat(w.id)}>
                          Release a seat
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
