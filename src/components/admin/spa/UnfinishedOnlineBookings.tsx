import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Phone, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/timeFormat";
import { toast } from "sonner";

type Row = { key: string; at: string; name: string | null; email: string | null; phone: string | null; serviceId: string | null; date: string | null; time: string | null; stopped: string; detail?: string | null; smsOptIn?: boolean };

const isTest = (e: string | null) => !e || /@example\.|\.invalid$|qa-probe|checkout-test/i.test(e);

/** People who started an online spa booking but never finished — for staff callbacks. Messages go out only when staff tap Send. */
export function UnfinishedOnlineBookings() {
  const [sent, setSent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["spa-unfinished-online"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const [{ data: pending }, { data: refused }, { data: booked }, { data: services }] = await Promise.all([
        supabase.from("spa_guest_checkouts").select("id,created_at,guest_name,guest_email,guest_phone,service_id,appointment_date,appointment_time,status,appointment_id,stop_reason,decline_message,sms_opt_in").is("appointment_id", null).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
        supabase.from("spa_guest_checkout_rejections").select("id,created_at,guest_name,guest_email,guest_phone,service_id,appointment_date,appointment_time,message").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
        supabase.from("spa_appointments").select("guest_email").gte("created_at", since).not("guest_email", "is", null).limit(1000),
        supabase.from("spa_services").select("id,name,category"),
      ]);
      const bookedEmails = new Set((booked ?? []).map((b) => b.guest_email?.toLowerCase()));
      const svc = new Map((services ?? []).map((s) => [s.id, s]));
      const rows: Row[] = [
        ...(pending ?? []).map((c) => ({ key: c.id, at: c.created_at, name: c.guest_name, email: c.guest_email, phone: c.guest_phone, serviceId: c.service_id, date: c.appointment_date, time: c.appointment_time, smsOptIn: !!c.sms_opt_in, stopped: c.stop_reason ?? (c.status === "pending" ? "On the card screen now, or reason still being checked" : "Left at card screen"), detail: c.decline_message })),
        ...(refused ?? []).map((r) => ({ key: r.id, at: r.created_at, name: r.guest_name, email: r.guest_email, phone: r.guest_phone, serviceId: r.service_id, date: r.appointment_date, time: r.appointment_time, stopped: `Turned down: ${r.message ?? ""}` })),
      ].filter((r) => !isTest(r.email) && !bookedEmails.has(r.email?.toLowerCase()));
      const byPerson = new Map<string, Row & { tries: number }>();
      for (const r of rows.sort((a, b) => b.at.localeCompare(a.at))) {
        const k = r.email!.toLowerCase();
        const cur = byPerson.get(k);
        if (cur) { cur.tries++; cur.smsOptIn = cur.smsOptIn || r.smsOptIn; } else byPerson.set(k, { ...r, tries: 1 });
      }
      return [...byPerson.values()].map((r) => {
        const s = r.serviceId ? svc.get(r.serviceId) : undefined;
        return { ...r, service: s?.name ?? "Spa treatment", category: s?.category ?? null };
      });
    },
  });

  const sendLink = async (r: NonNullable<typeof data>[number]) => {
    setBusy(r.key);
    const visitDate = r.date ? format(parseISO(r.date), "EEEE, MMMM d") : "";
    const visitTime = r.time ? formatTime12h(String(r.time).slice(0, 5)) : "";
    const { error } = await supabase.functions.invoke("send-email", {
      body: { type: "spa_checkout_resume", to: r.email, data: { name: r.name, serviceName: r.service, visitDate, visitTime, category: r.category } },
    });
    if (error) { setBusy(null); toast.error("Email could not be sent"); return; }
    let textNote = "no text consent";
    if (r.phone && r.smsOptIn) {
      const { error: smsErr } = await supabase.functions.invoke("send-sms", {
        body: {
          to: { phone: r.phone },
          templateKey: "admin-custom",
          variables: { customBody: `Spa Aella at Storm Wellness Club: ${(r.name ?? "").trim().split(" ")[0] ? (r.name ?? "").trim().split(" ")[0] + ", y" : "Y"}our ${r.service}${visitDate ? ` on ${format(parseISO(r.date!), "EEE MMM d")}${visitTime ? ` at ${visitTime}` : ""}` : ""} is one step from confirmed. Complete your booking here: https://stormwellnessclub.com/spa` },
          idempotencyKey: `spa-resume-${r.key}`,
          metadata: { source: "UnfinishedOnlineBookings" },
        },
      });
      textNote = smsErr ? "text not sent" : "text sent";
    }
    setBusy(null);
    setSent((p) => ({ ...p, [r.key]: `Email sent · ${textNote}` }));
    toast.success(`Finish-booking link sent to ${r.name ?? r.email}`);
  };

  if (!data?.length) return null;
  return (
    <Card className="mb-4 border-destructive/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unfinished online bookings ({data.length})</CardTitle>
        <CardDescription>Started booking online in the last 14 days but didn't finish. Call them, or send them a link to finish.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {data.map((r) => (
          <div key={r.key} className="px-4 py-3 text-sm flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{r.name} {r.tries > 1 && <Badge variant="outline" className="ml-1">{r.tries} tries</Badge>}</div>
              <div className="text-muted-foreground">{r.service}{r.date ? ` · ${format(parseISO(r.date), "EEE, MMM d")}` : ""}{r.time ? ` at ${formatTime12h(String(r.time).slice(0, 5))}` : ""}</div>
              <div className="text-xs"><span className={/declined/i.test(r.stopped) ? "font-medium text-destructive" : "text-muted-foreground"}>{r.stopped}</span><span className="text-muted-foreground"> · {format(parseISO(r.at), "MMM d, h:mm a")}</span></div>
              {r.detail && <div className="text-xs text-muted-foreground italic">Bank said: {r.detail}</div>}
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              {r.phone && <a className="flex items-center gap-1 text-primary" href={`tel:${r.phone}`}><Phone className="h-3 w-3" />{r.phone}</a>}
              {r.email && <a className="flex items-center gap-1 text-primary" href={`mailto:${r.email}`}><Mail className="h-3 w-3" />{r.email}</a>}
              {sent[r.key] ? (
                <span className="text-muted-foreground">{sent[r.key]}</span>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === r.key} onClick={() => sendLink(r)}>
                  <Send className="h-3 w-3 mr-1" />{busy === r.key ? "Sending…" : "Send finish-booking link"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
