import { Link } from "react-router-dom";
import { useMySocietyInterest } from "@/hooks/useHigherSelfSociety";
import { useIsSocietyMember } from "@/components/society/SocietyRsvp";
import { SocietyPortalEvents } from "@/components/society/SocietyPortalEvents";
import heroImg from "@/assets/society/heart.jpg.asset.json";

/** Dashboard card: current book + RSVP for book club members, invitation for everyone else. */
export function HigherSelfSocietyCard() {
  const { data: mine } = useMySocietyInterest();
  const { data: onRoster } = useIsSocietyMember();
  const member = !!mine || onRoster === true;

  if (member) return <SocietyPortalEvents />;

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
          A monthly reading circle for members. Sign up for the next round and suggest a book.
        </p>
        <span className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--society-gold))]">Join the next round →</span>
      </div>
    </Link>
  );
}
