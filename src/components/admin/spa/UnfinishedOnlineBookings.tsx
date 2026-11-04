import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime12h } from "@/lib/timeFormat";

type Row = { key: string; at: string; name: string | null; email: string | null; phone: string | null; serviceId: string | null; date: string | null; time: string | null; stopped: string };

const isTest = (e: string | null) => !e || /@example\.|\.invalid$|qa-probe|checkout-test/i.test(e);

/** People who started an online spa booking but never finished — for staff callbacks. Nothing is sent automatically. */
export function UnfinishedOnlineBookings() {
  const { data } = useQuery({
    queryKey: ["spa-unfinished-online"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const [{ data: pending }, { data: refused }, { data: booked }, { data: services }] = await Promise.all([
        supabase.from("spa_guest_checkouts").select("id,created_at,guest_name,guest_email,guest_phone,service_id,appointment_date,appointment_time,status,appointment_id,stop_reason,decline_message").is("appointment_id", null).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
        supabase.from("spa_guest_checkout_rejections").select("id,created_at,guest_name,guest_email,guest_phone,service_id,appointment_date,appointment_time,message").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
        supabase.from("spa_appointments").select("guest_email").gte("created_at", since).not("guest_email", "is", null).limit(1000),
        supabase.from("spa_services").select("id,name"),
      ]);
      const bookedEmails = new Set((booked ?? []).map((b) => b.guest_email?.toLowerCase()));
      const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
      const rows: Row[] = [
        ...(pending ?? []).map((c) => ({ key: c.id, at: c.created_at, name: c.guest_name, email: c.guest_email, phone: c.guest_phone, serviceId: c.service_id, date: c.appointment_date, time: c.appointment_time, stopped: c.stop_reason ?? (c.status === "pending" ? "On the card screen now, or reason still being checked" : "Left at card screen"), detail: c.decline_message })),
        ...(refused ?? []).map((r) => ({ key: r.id, at: r.created_at, name: r.guest_name, email: r.guest_email, phone: r.guest_phone, serviceId: r.service_id, date: r.appointment_date, time: r.appointment_time, stopped: `Refused: ${r.message ?? ""}` })),
      ].filter((r) => !isTest(r.email) && !bookedEmails.has(r.email?.toLowerCase()));
      // One line per person, newest attempt first.
      const byPerson = new Map<string, Row & { tries: number }>();
      for (const r of rows.sort((a, b) => b.at.localeCompare(a.at))) {
        const k = r.email!.toLowerCase();
        const cur = byPerson.get(k);
        if (cur) cur.tries++; else byPerson.set(k, { ...r, tries: 1 });
      }
      return [...byPerson.values()].map((r) => ({ ...r, service: r.serviceId ? serviceName.get(r.serviceId) ?? "Spa treatment" : "Spa treatment" }));
    },
  });
  if (!data?.length) return null;
  return (
    <Card className="mb-4 border-destructive/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unfinished online bookings ({data.length})</CardTitle>
        <CardDescription>Started booking online in the last 14 days but didn't finish. Call them to book.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {data.map((r) => (
          <div key={r.key} className="px-4 py-3 text-sm flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{r.name} {r.tries > 1 && <Badge variant="outline" className="ml-1">{r.tries} tries</Badge>}</div>
              <div className="text-muted-foreground">{r.service}{r.date ? ` · ${format(parseISO(r.date), "EEE, MMM d")}` : ""}{r.time ? ` at ${formatTime12h(String(r.time).slice(0, 5))}` : ""}</div>
              <div className="text-xs text-muted-foreground">{r.stopped} · {format(parseISO(r.at), "MMM d, h:mm a")}</div>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              {r.phone && <a className="flex items-center gap-1 text-primary" href={`tel:${r.phone}`}><Phone className="h-3 w-3" />{r.phone}</a>}
              {r.email && <a className="flex items-center gap-1 text-primary" href={`mailto:${r.email}`}><Mail className="h-3 w-3" />{r.email}</a>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
