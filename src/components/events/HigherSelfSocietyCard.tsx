import { Link } from "react-router-dom";
import { useMySocietyInterest } from "@/hooks/useHigherSelfSociety";
import { CURRENT_ROUND, coverUrl, currentBook } from "@/lib/societyBooks";
import { SocietyRsvp, useIsSocietyMember } from "@/components/society/SocietyRsvp";
import heroImg from "@/assets/society/heart.jpg.asset.json";

/** Dashboard card: current book + RSVP for book club members, invitation for everyone else. */
export function HigherSelfSocietyCard() {
  const { data: mine } = useMySocietyInterest();
  const { data: onRoster } = useIsSocietyMember();
  const member = !!mine || onRoster === true;
  const b = currentBook();

  if (member) {
    return (
      <div className="society-theme relative overflow-hidden rounded-lg border border-[hsl(var(--society-line)/0.6)]">
        <div className="relative p-6 flex gap-5">
          <img src={coverUrl(b.isbn)} alt={`Cover of ${b.title}`} className="w-20 aspect-[2/3] object-cover rounded-sm shadow-lg shrink-0" />
          <div className="min-w-0">
            <p className="uppercase tracking-[0.3em] text-[10px] text-[hsl(var(--society-gold))]">Higher Self Society · Currently reading</p>
            <h3 className="font-serif text-2xl mt-2">{b.title}</h3>
            <p className="text-sm text-[hsl(var(--society-muted))]">{b.author}</p>
            <p className="text-sm mt-3">First gathering: {CURRENT_ROUND.meetingLabel}</p>
            <SocietyRsvp compact />
            <Link to="/rituals/higher-self-society" className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--society-gold))]">
              Book club page →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to="/rituals/higher-self-society#join"
      className="society-theme relative block overflow-hidden rounded-lg border border-[hsl(var(--society-line)/0.6)]"
    >
      <img src={heroImg.url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="relative p-6">
        <p className="uppercase tracking-[0.3em] text-[10px] text-[hsl(var(--society-gold))]">Member reading circle</p>
        <h3 className="font-serif text-2xl mt-2">The Higher Self Society</h3>
        <p className="text-sm mt-2 text-[hsl(var(--society-muted))]">
          Our circle is reading The 48 Laws of Power. The next round is open: sign up and suggest a book.
        </p>
        <span className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--society-gold))]">Join the next round →</span>
      </div>
    </Link>
  );
}
