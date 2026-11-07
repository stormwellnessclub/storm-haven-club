import { formatInTimeZone } from "date-fns-tz";
import { SOCIETY_BOOKS, SOCIETY_ROUNDS, coverUrl } from "@/lib/societyBooks";
import { arrangeRounds } from "@/lib/eventRsvp";
import { useSocietyGatherings, type SocietyGathering } from "@/hooks/useSocietyGatherings";
import { addToCalendarUrl } from "@/lib/rituals";
import { SocietyRsvp } from "./SocietyRsvp";

const gold = "text-[hsl(var(--society-gold))]";
const muted = "text-[hsl(var(--society-muted))]";
const TZ = "America/Detroit";

export const gatheringWhen = (g: SocietyGathering) =>
  `${formatInTimeZone(new Date(g.starts_at), TZ, "EEEE, MMMM d, yyyy · h:mm")}–${formatInTimeZone(new Date(g.ends_at ?? g.starts_at), TZ, "h:mm a")}`;

export const bookFor = (g: SocietyGathering | null) => {
  const key = SOCIETY_ROUNDS.find((r) => r.key === g?.round_key)?.bookKey;
  return key ? SOCIETY_BOOKS.find((b) => b.key === key) ?? null : null;
};

export function useSocietyRounds() {
  const { data = [], isLoading } = useSocietyGatherings();
  return { ...arrangeRounds(data), isLoading };
}

/** Current Round — the dominant section. */
export function SocietyCurrentlyReading() {
  const { current } = useSocietyRounds();
  if (!current) return null;
  const b = bookFor(current);
  const month = formatInTimeZone(new Date(current.starts_at), TZ, "MMMM");
  return (
    <section id="currently-reading" className="container mx-auto px-4 sm:px-6 py-16 max-w-4xl border-b border-[hsl(var(--society-line)/0.5)]">
      <p className={`uppercase tracking-[0.35em] text-xs text-center ${gold}`}>Current Round — {month} Gathering</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-8 items-center sm:items-start">
        {b && <img src={coverUrl(b.isbn)} alt={`Cover of ${b.title}`} className="w-36 sm:w-44 aspect-[2/3] object-cover rounded-sm shadow-lg shrink-0" />}
        <div className="text-center sm:text-left">
          <h2 className="font-serif text-3xl sm:text-4xl">{b?.title ?? "Book to be announced"}</h2>
          {b && <p className={`mt-1 ${muted}`}>{b.author}</p>}
          {b && <p className={`mt-4 leading-relaxed ${muted}`}>{b.synopsis}</p>}
          <p className="mt-5"><span className={gold}>{gatheringWhen(current)}</span></p>
          <p className={`text-sm ${muted}`}>{current.venue ?? "Storm Wellness Club"} · Members only</p>
          <SocietyRsvp eventId={current.id} />
          <a href={addToCalendarUrl({ ...current, description: current.description })} target="_blank" rel="noreferrer"
            className={`inline-block mt-4 text-xs uppercase tracking-[0.2em] ${gold}`}>Add to calendar</a>
        </div>
      </div>
    </section>
  );
}

/** Next Round — one compact section. */
export function SocietyNextRound({ children }: { children?: React.ReactNode }) {
  const { next } = useSocietyRounds();
  if (!next) return null;
  const b = bookFor(next);
  const meta = SOCIETY_ROUNDS.find((r) => r.key === next.round_key);
  const voting = next.round_state === "voting_open" || next.round_state === "nominations_open";
  return (
    <section id="next-round" className="container mx-auto px-4 sm:px-6 py-14 max-w-3xl border-b border-[hsl(var(--society-line)/0.5)] text-center">
      <p className={`uppercase tracking-[0.35em] text-xs ${gold}`}>Next Round</p>
      <h2 className="font-serif text-3xl mt-4">{b ? b.title : "Book not yet selected"}</h2>
      <p className="mt-3">{gatheringWhen(next)}</p>
      <p className={`mt-3 text-sm leading-relaxed ${muted}`}>
        {b ? "The book has been chosen." : voting
          ? `Members are suggesting and voting on the book now${meta?.voteClosesLabel ? `; voting closes ${meta.voteClosesLabel}` : ""}. The book is announced by the end of November.`
          : "The book will be announced once member voting closes."}
      </p>
      {children}
    </section>
  );
}
