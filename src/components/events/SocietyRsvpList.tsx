import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { SOCIETY_ROUNDS } from "@/lib/societyBooks";
import type { AttendanceRow, AttendanceStatus } from "@/lib/societyRoundAttendance";

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  yes: "Going", maybe: "Maybe", spot: "Event spot", no: "Can't make it", dismissed: "Closed reminder", none: "No answer",
};
const roundShort = (k: string) => SOCIETY_ROUNDS.find((r) => r.key === k)?.label.split(":")[0] ?? k;

/** The shared Higher Self Society list (useSocietyRoundAttendance): same names and counts on every page. */
export function SocietyRsvpList({ rows, showContact = true, showLink = true }: { rows: AttendanceRow[]; showContact?: boolean; showLink?: boolean }) {
  const n = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <strong>{n("yes")}</strong> going · <strong>{n("maybe")}</strong> maybe · <strong>{n("spot")}</strong> event spots ·{" "}
          <strong>{n("no")}</strong> can't make it · <strong>{n("none") + n("dismissed")}</strong> no answer
        </span>
        {showLink && <Link to="/events-portal/society" className="text-xs underline text-muted-foreground">Open Higher Self Society</Link>}
      </div>
      <div className="border rounded divide-y text-sm max-h-96 overflow-auto">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium truncate">
                {r.name}
                {r.rounds.length > 1 && <span className="ml-2 text-xs font-normal text-muted-foreground">Also in {r.rounds.slice(1).map(roundShort).join(", ")}</span>}
              </div>
              {showContact && <div className="text-xs text-muted-foreground truncate">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>}
            </div>
            <Badge variant={r.status === "yes" ? "default" : r.status === "none" || r.status === "dismissed" ? "outline" : "secondary"}>{ATTENDANCE_LABEL[r.status]}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
