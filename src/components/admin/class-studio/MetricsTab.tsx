import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download } from "lucide-react";
import { normalizeRoom, formatTimeLabel } from "@/lib/studios";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MetricsTab() {
  const [days, setDays] = useState("30");
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(new Date(), parseInt(days, 10)), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["class-studio-metrics", start, end],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from("class_sessions")
        .select(
          `id, session_date, start_time, room, max_capacity, current_enrollment, is_cancelled, instructor_id,
           class_types!inner (name), instructors (first_name, last_name)`,
        )
        .gte("session_date", start)
        .lte("session_date", end);
      if (error) throw error;

      const ids = (sessions || []).map((s: any) => s.id);
      let bookings: any[] = [];
      for (let i = 0; i < ids.length; i += 300) {
        const { data: b, error: bErr } = await supabase
          .from("class_bookings")
          .select("id, session_id, status")
          .in("session_id", ids.slice(i, i + 300));
        if (bErr) throw bErr;
        bookings = bookings.concat(b || []);
      }
      return { sessions: sessions || [], bookings };
    },
    staleTime: 5 * 60_000,
  });

  const metrics = useMemo(() => {
    const sessions = (data?.sessions || []).filter((s: any) => !s.is_cancelled);
    const bookings = data?.bookings || [];
    const cap = sessions.reduce((a: number, s: any) => a + (s.max_capacity || 0), 0);
    const booked = sessions.reduce((a: number, s: any) => a + (s.current_enrollment || 0), 0);
    const noShows = bookings.filter((b) => b.status === "no_show").length;
    const attended = bookings.filter((b) => b.status === "completed").length;

    const group = (keyFn: (s: any) => string) => {
      const m = new Map<string, { cap: number; booked: number; count: number }>();
      sessions.forEach((s: any) => {
        const k = keyFn(s);
        const cur = m.get(k) || { cap: 0, booked: 0, count: 0 };
        cur.cap += s.max_capacity || 0;
        cur.booked += s.current_enrollment || 0;
        cur.count += 1;
        m.set(k, cur);
      });
      return [...m.entries()]
        .map(([k, v]) => ({ key: k, ...v, fill: v.cap ? Math.round((v.booked / v.cap) * 100) : 0 }))
        .sort((a, b) => b.fill - a.fill);
    };

    const byStudio = group((s) => normalizeRoom(s.room));
    const byType = group((s) => s.class_types?.name || "Unknown");
    const byInstructor = group((s) =>
      s.instructors ? `${s.instructors.first_name} ${s.instructors.last_name}` : "Unstaffed",
    );
    const bySlot = group((s) => {
      const d = new Date(`${s.session_date}T00:00:00`).getDay();
      return `${DAY_NAMES[d]} ${formatTimeLabel(s.start_time)} · ${normalizeRoom(s.room)}`;
    }).filter((r) => r.count >= 2);

    return {
      sessionCount: sessions.length,
      cancelled: (data?.sessions || []).length - sessions.length,
      fill: cap ? Math.round((booked / cap) * 100) : 0,
      booked,
      emptySeats: Math.max(0, cap - booked),
      noShowRate: attended + noShows ? Math.round((noShows / (attended + noShows)) * 100) : 0,
      byStudio,
      byType,
      byInstructor,
      best: bySlot.slice(0, 5),
      worst: bySlot.slice(-5).reverse(),
    };
  }, [data]);

  const exportCsv = () => {
    const rows: string[][] = [["Group", "Name", "Sessions", "Seats", "Booked", "Fill %"]];
    const push = (label: string, list: any[]) =>
      list.forEach((r) => rows.push([label, r.key, String(r.count), String(r.cap), String(r.booked), String(r.fill)]));
    push("Studio", metrics.byStudio);
    push("Class type", metrics.byType);
    push("Instructor", metrics.byInstructor);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `class-studio-metrics-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Bars = ({ title, rows }: { title: string; rows: any[] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
        {rows.slice(0, 8).map((r) => (
          <div key={r.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="truncate">{r.key}</span>
              <span className="text-muted-foreground">{r.fill}% · {r.count} classes</span>
            </div>
            <Progress value={r.fill} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Classes held", value: metrics.sessionCount },
          { label: "Fill rate", value: `${metrics.fill}%` },
          { label: "Seats booked", value: metrics.booked },
          { label: "Empty seats", value: metrics.emptySeats },
          { label: "No-show rate", value: `${metrics.noShowRate}%` },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bars title="Fill by studio" rows={metrics.byStudio} />
        <Bars title="Fill by class type" rows={metrics.byType} />
        <Bars title="Instructor leaderboard" rows={metrics.byInstructor} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Best & worst time slots</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Strongest</p>
              {metrics.best.map((r) => (
                <div key={r.key} className="flex justify-between text-xs py-0.5">
                  <span className="truncate">{r.key}</span>
                  <span className="font-medium">{r.fill}%</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Weakest — consider pruning</p>
              {metrics.worst.map((r) => (
                <div key={r.key} className="flex justify-between text-xs py-0.5">
                  <span className="truncate">{r.key}</span>
                  <span className="font-medium text-destructive">{r.fill}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
