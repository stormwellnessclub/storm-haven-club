import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { SocietyRsvpRow } from "@/hooks/useSocietyEventRsvps";

const LABEL: Record<string, string> = { yes: "Going", maybe: "Maybe", no: "Can't make it", dismissed: "Dismissed" };
const ORDER = ["yes", "maybe", "no", "dismissed"];

/** Society RSVPs shown beside tickets; members RSVP on the Society page, not through tickets. */
export function SocietyRsvpList({ rows, showContact = true }: { rows: SocietyRsvpRow[]; showContact?: boolean }) {
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.response) - ORDER.indexOf(b.response) || a.name.localeCompare(b.name));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          <strong>{rows.filter((r) => r.response === "yes").length}</strong> going ·{" "}
          <strong>{rows.filter((r) => r.response === "maybe").length}</strong> maybe (society RSVPs)
        </span>
        <Link to="/events-portal/society" className="text-xs underline text-muted-foreground">Open Higher Self Society</Link>
      </div>
      <div className="border rounded divide-y text-sm max-h-80 overflow-auto">
        {sorted.map((r) => (
          <div key={r.user_id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              {showContact && <div className="text-xs text-muted-foreground truncate">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>}
            </div>
            <Badge variant={r.response === "yes" ? "default" : "secondary"}>{LABEL[r.response] ?? r.response}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
