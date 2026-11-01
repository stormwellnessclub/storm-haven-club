import { CURRENT_ROUND, NEXT_ROUND, coverUrl, currentBook } from "@/lib/societyBooks";
import { SocietyRsvp } from "./SocietyRsvp";

const gold = "text-[hsl(var(--society-gold))]";
const muted = "text-[hsl(var(--society-muted))]";

export function SocietyCurrentlyReading() {
  const b = currentBook();
  return (
    <section id="currently-reading" className="container mx-auto px-4 sm:px-6 py-16 max-w-4xl border-b border-[hsl(var(--society-line)/0.5)]">
      <p className={`uppercase tracking-[0.35em] text-xs text-center ${gold}`}>Currently reading</p>
      <div className="mt-8 flex flex-col sm:flex-row gap-8 items-center sm:items-start">
        <img src={coverUrl(b.isbn)} alt={`Cover of ${b.title}`} className="w-36 sm:w-44 aspect-[2/3] object-cover rounded-sm shadow-lg shrink-0" />
        <div className="text-center sm:text-left">
          <h2 className="font-serif text-3xl sm:text-4xl">{b.title}</h2>
          <p className={`mt-1 ${muted}`}>{b.author}</p>
          <p className={`mt-4 leading-relaxed ${muted}`}>{b.synopsis}</p>
          <p className="mt-5">First gathering: <span className={gold}>{CURRENT_ROUND.meetingLabel}</span></p>
          <SocietyRsvp />
        </div>
      </div>
      <div className="mt-12 border border-[hsl(var(--society-line))] rounded-sm p-6 text-center">
        <p className={`uppercase tracking-[0.3em] text-xs ${gold}`}>Join the next round</p>
        <p className={`mt-3 text-sm leading-relaxed ${muted}`}>
          Sign up below and share the titles you would love to read. Voting closes {NEXT_ROUND.voteClosesLabel},
          the book is chosen by the end of November, and we meet {NEXT_ROUND.meetingLabel.replace(" · ", ", ")}.
        </p>
        <a href="#join" className={`inline-block mt-4 text-xs uppercase tracking-[0.2em] ${gold}`}>Sign up for the next round →</a>
      </div>
    </section>
  );
}
