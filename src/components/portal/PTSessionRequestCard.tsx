import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { format as fmtDate, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REQUEST_STATUS_LABEL } from "@/hooks/pt/usePTRequests";

interface MyBooking {
  is_client: boolean;
  any_trainer_mode: "off" | "request" | "instant";
  trainers: { id: string; name: string; mode: "request" | "instant" }[];
}

const ANY = "any";
const OPEN = ["requested", "under_review", "alternate_offered"];

function detroitToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit" }).format(new Date());
}

/**
 * "Request a PT Session" for current PT clients (members and non-members alike).
 * Shown only when the club/trainer booking mode allows requests; submits into the
 * staff-reviewed request workflow and never creates an appointment itself.
 */
export function PTSessionRequestCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [flex, setFlex] = useState("");
  const [note, setNote] = useState("");

  const { data: booking } = useQuery({
    queryKey: ["pt-my-client-booking", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_my_client_booking");
      if (error) throw error;
      return data as MyBooking;
    },
  });

  const requestTrainers = (booking?.trainers ?? []).filter((t) => t.mode === "request");
  const anyAllowed = booking?.any_trainer_mode === "request";
  const canRequest = !!booking?.is_client && (anyAllowed || requestTrainers.length > 0);

  const { data: sessionTypes = [] } = useQuery({
    queryKey: ["pt-request-session-types"],
    enabled: canRequest,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_session_types").select("id,name,duration_minutes").eq("is_active", true).order("display_order");
      return (data ?? []) as { id: string; name: string; duration_minutes: number }[];
    },
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["pt-my-requests", user?.id],
    enabled: canRequest,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("training_requests")
        .select("id, service, preferred_date, preferred_time, request_status, alt_date, alt_time")
        .eq("client_user_id", user!.id)
        .eq("request_kind", "appointment_request")
        .in("request_status", OPEN)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as any[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("pt_request_create", {
        p_session_type_id: sessionTypeId,
        p_trainer_id: trainerId && trainerId !== ANY ? trainerId : null,
        p_preferred_date: date,
        p_preferred_time: time || null,
        p_flexibility_note: flex || null,
        p_client_note: note || null,
      });
      if (error) throw new Error(String(error.message).replace(/^REQUESTS_CLOSED:\s*/, ""));
    },
    onSuccess: () => {
      toast.success("Request sent. Your trainer will confirm or suggest another time.");
      setOpen(false); setSessionTypeId(""); setTrainerId(""); setDate(""); setTime(""); setFlex(""); setNote("");
      qc.invalidateQueries({ queryKey: ["pt-my-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Online PT scheduling is not active until the owner approves it: PT clients see a
  // non-interactive "Coming Soon" action. It never opens trainer availability.
  if (booking?.is_client) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarPlus className="h-4 w-4" /> Request / Book a Session
          </CardTitle>
          <Button size="sm" variant="outline" disabled aria-disabled="true">Coming Soon</Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Online scheduling is coming soon. Message us or ask your trainer to book your next session.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!canRequest) return null;

  const trainerRequired = !anyAllowed;
  const ready = !!sessionTypeId && !!date && (!trainerRequired || (!!trainerId && trainerId !== ANY));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" /> Request a PT Session
        </CardTitle>
        {!open && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Request</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {myRequests.length > 0 && (
          <div className="space-y-1.5">
            {myRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 p-2.5 text-xs">
                <span className="truncate">
                  {r.service} · {r.preferred_date ? fmtDate(parseISO(r.preferred_date), "EEE, MMM d") : ""}
                  {r.preferred_time ? ` · ${r.preferred_time.slice(0, 5)}` : ""}
                  {r.request_status === "alternate_offered" && r.alt_date
                    ? ` → suggested ${fmtDate(parseISO(r.alt_date), "EEE, MMM d")}${r.alt_time ? ` ${r.alt_time.slice(0, 5)}` : ""}`
                    : ""}
                </span>
                <span className="text-muted-foreground shrink-0">{REQUEST_STATUS_LABEL[r.request_status] ?? r.request_status}</span>
              </div>
            ))}
          </div>
        )}

        {!open ? (
          <p className="text-xs text-muted-foreground">
            Ask for a day and time. It isn't booked until your trainer confirms it or suggests another time.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (ready) submit.mutate(); }}
          >
            <div>
              <Label>Session</Label>
              <Select value={sessionTypeId} onValueChange={setSessionTypeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a session" /></SelectTrigger>
                <SelectContent>
                  {sessionTypes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trainer</Label>
              <Select value={trainerId} onValueChange={setTrainerId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a trainer" /></SelectTrigger>
                <SelectContent>
                  {anyAllowed && <SelectItem value={ANY}>Any trainer</SelectItem>}
                  {requestTrainers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pt-req-date">Preferred date</Label>
                <Input id="pt-req-date" type="date" min={detroitToday()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pt-req-time">Preferred time</Label>
                <Input id="pt-req-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="pt-req-flex">Flexibility (optional)</Label>
              <Input id="pt-req-flex" maxLength={500} placeholder="e.g. any weekday morning" value={flex} onChange={(e) => setFlex(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="pt-req-note">Note for your trainer (optional)</Label>
              <Textarea id="pt-req-note" maxLength={2000} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!ready || submit.isPending}>
                {submit.isPending ? "Sending…" : "Send request"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
