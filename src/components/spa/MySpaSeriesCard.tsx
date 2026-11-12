import { Link } from "react-router-dom";
import { format, parse } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { useMySpaPackages } from "@/hooks/useSpaClientPackages";
import { formatTime12h } from "@/lib/timeFormat";

const d = (iso: string) => format(parse(iso, "yyyy-MM-dd", new Date()), "MMM d, yyyy");

/** Client view of purchased Aella Sculpt treatments/series. Shows nothing until something is purchased. */
export function MySpaSeriesCard() {
  const { data = [] } = useMySpaPackages("aella-sculpt");
  const list = data.filter((s) => s.pkg.status === "active");
  if (!list.length) return null;
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Aella Sculpt</p>
        {list.map((s) => (
          <div key={s.pkg.id} className="space-y-1 text-sm">
            <p className="font-medium">{s.pkg.package_name}</p>
            <p className="text-muted-foreground">
              Sessions purchased {s.pkg.sessions_total} · used {s.used} · remaining {s.remaining}
              {s.pkg.expires_on ? ` · ${s.expired ? "expired" : "expires"} ${d(s.pkg.expires_on)}` : ""}
            </p>
            {s.next && <p>Next appointment: {d(s.next.appointment_date)} · {formatTime12h(s.next.appointment_time.slice(0, 5))}{s.next.treatment_zone_name ? ` · ${s.next.treatment_zone_name}` : ""}</p>}
            {s.previous.length > 0 && <p className="text-muted-foreground">Previous: {s.previous.slice(0, 4).map((p) => d(p.appointment_date)).join(", ")}</p>}
            {s.usable && <Link to="/spa/preview/aella-sculpt#book" className="inline-block pt-1 text-sm underline underline-offset-4">Schedule next treatment</Link>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
