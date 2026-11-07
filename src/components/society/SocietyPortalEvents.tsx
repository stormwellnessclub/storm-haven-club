import { Link } from "react-router-dom";
import { useSocietyGatherings, useMySocietyRsvps, type SocietyGathering } from "@/hooks/useSocietyGatherings";
import { portalBucket, type PortalBucket, type RsvpResponse } from "@/lib/eventRsvp";
import { addToCalendarUrl } from "@/lib/rituals";
import { gatheringWhen, bookFor } from "./SocietyCurrentlyReading";
import { SocietyRsvp } from "./SocietyRsvp";

const gold = "text-[hsl(var(--society-gold))]";
const muted = "text-[hsl(var(--society-muted))]";
const HEADINGS: [PortalBucket, string][] = [
  ["upcoming", "Upcoming"], ["considering", "Considering"], ["invitation", "Invitations"], ["past", "Past"],
];
const STATUS: Record<string, string> = { upcoming: "You're attending", considering: "Considering", invitation: "New invitation", past: "Attended" };

/** Member portal: Higher Self Society gatherings grouped by the member's reply. Never a pop-up. */
export function SocietyPortalEvents() {
  const { data: gatherings = [] } = useSocietyGatherings();
  const { data: mine, isLoading } = useMySocietyRsvps();
  if (isLoading || !mine) return null;
  const grouped = new Map<PortalBucket, SocietyGathering[]>();
  for (const g of gatherings) {
    const b = portalBucket((mine[g.id] ?? null) as RsvpResponse, g.ends_at ?? g.starts_at);
    if (b === "hidden") continue;
    // Only the nearest unanswered gathering shows as an invitation.
    if (b === "invitation" && (grouped.get("invitation")?.length ?? 0) > 0) continue;
    grouped.set(b, [...(grouped.get(b) ?? []), g]);
  }
  if (grouped.size === 0) return null;

  return (
    <div className="society-theme rounded-lg border border-[hsl(var(--society-line)/0.6)] p-6 space-y-6">
      <p className={`uppercase tracking-[0.3em] text-[10px] ${gold}`}>Higher Self Society</p>
      {HEADINGS.filter(([k]) => grouped.has(k)).map(([k, label]) => (
        <div key={k}>
          <h3 className="font-serif text-lg">{label}</h3>
          {grouped.get(k)!.map((g) => (
            <div key={g.id} className="mt-3 border-t border-[hsl(var(--society-line)/0.4)] pt-3">
              <p className="font-serif text-xl">{bookFor(g)?.title ?? g.subtitle ?? g.title}</p>
              <p className={`text-sm ${muted}`}>{gatheringWhen(g)} · {g.venue ?? "Storm Wellness Club"}</p>
              <p className={`text-xs mt-1 ${muted}`}>Members only · <span className={gold}>{STATUS[k]}</span></p>
              {k !== "past" && <SocietyRsvp eventId={g.id} compact allowDismiss={k === "invitation"} />}
              <div className="mt-3 flex gap-5 text-xs uppercase tracking-[0.2em]">
                <Link to="/rituals/higher-self-society#currently-reading" className={gold}>Event details</Link>
                {k !== "past" && (
                  <a href={addToCalendarUrl(g)} target="_blank" rel="noreferrer" className={gold}>Add to calendar</a>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
