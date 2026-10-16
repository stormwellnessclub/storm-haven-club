import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Phone, Mail, Clock, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminSpaBookingModal } from "@/components/admin/spa/AdminSpaBookingModal";
import { useSpaServiceRequests, setSpaRequestStatus, type SpaRequest } from "@/hooks/useSpaServiceRequests";
import { formatTime12h } from "@/lib/parseTimeInput";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  booked: "Booked",
  contacted: "Contacted",
  declined: "Declined",
};

function fmtWhen(date: string | null, time: string | null) {
  if (!date) return null;
  const d = format(parseISO(date), "EEE, MMM d");
  return time ? `${d} at ${formatTime12h(time)}` : d;
}

export function SpaRequestsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useSpaServiceRequests();
  const [showHandled, setShowHandled] = useState(false);
  const [booking, setBooking] = useState<SpaRequest | null>(null);

  const mark = async (r: SpaRequest, status: string) => {
    try {
      await setSpaRequestStatus(r.id, status);
      qc.invalidateQueries({ queryKey: ["spa-service-requests"] });
      toast.success(`Marked ${STATUS_LABEL[status]}`);
    } catch (e: any) {
      toast.error(e.message || "Could not update request");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const all = data ?? [];
  const list = showHandled ? all : all.filter((r) => r.status === "new");
  const newCount = all.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {newCount} new request{newCount === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Switch id="show-handled" checked={showHandled} onCheckedChange={setShowHandled} />
          <Label htmlFor="show-handled" className="text-sm">Show handled</Label>
        </div>
      </div>

      {!list.length && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {showHandled ? "No service requests yet." : "No new requests."}
          </CardContent>
        </Card>
      )}

      {list.map((req) => {
        const isOzone = /ozone/i.test(req.service_name || "");
        const first = fmtWhen(req.requested_date, req.requested_time);
        const alt = fmtWhen(req.alt_date, req.alt_time);
        return (
          <Card key={req.id} className={req.status === "new" ? "border-accent/60" : "opacity-80"}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {req.service_name}
                    {isOzone && (
                      <Badge variant="outline" className="ml-2">Call required · 30 min + 15 min cleanup</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {req.name} · sent {format(parseISO(req.created_at), "MMM d, yyyy h:mm a")}
                  </CardDescription>
                </div>
                <div className="flex gap-1.5">
                  {req.service_category && <Badge variant="secondary">{req.service_category}</Badge>}
                  <Badge variant={req.status === "new" ? "destructive" : "outline"}>
                    {STATUS_LABEL[req.status] || req.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(first || req.preferred_time) && (
                <div className="rounded-md bg-muted/50 p-2 space-y-0.5">
                  {first && <p className="font-medium text-foreground">Wants: {first}</p>}
                  {alt && <p className="text-muted-foreground">Second choice: {alt}</p>}
                  {!first && req.preferred_time && (
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Prefers: {req.preferred_time}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                {req.phone && (
                  <a href={`tel:${req.phone}`} className="flex items-center gap-1.5 text-accent">
                    <Phone className="h-3.5 w-3.5" /> {req.phone}
                  </a>
                )}
                <a href={`mailto:${req.email}`} className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {req.email}
                </a>
              </div>
              {req.message && <p className="text-muted-foreground">{req.message}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {req.status !== "booked" && (
                  <Button size="sm" onClick={() => setBooking(req)}>
                    <CalendarPlus className="h-4 w-4 mr-1" /> Book this request
                  </Button>
                )}
                {req.status === "new" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => mark(req, "contacted")}>Contacted</Button>
                    <Button size="sm" variant="outline" onClick={() => mark(req, "declined")}>Decline</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => mark(req, "new")}>Move back to New</Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {booking && (
        <AdminSpaBookingModal
          open={!!booking}
          onOpenChange={(o) => !o && setBooking(null)}
          defaultDate={booking.requested_date ? parseISO(booking.requested_date) : undefined}
          prefill={{
            serviceName: booking.service_name,
            date: booking.requested_date,
            time: booking.requested_time,
            name: booking.name,
            email: booking.email,
            phone: booking.phone,
            notes: booking.message,
          }}
          onBooked={async (apptId) => {
            try {
              await setSpaRequestStatus(booking.id, "booked", apptId ?? null);
              qc.invalidateQueries({ queryKey: ["spa-service-requests"] });
            } catch {
              /* booking itself succeeded; staff can mark manually */
            }
            setBooking(null);
          }}
        />
      )}
    </div>
  );
}
