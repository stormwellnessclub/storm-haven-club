import { Link } from "react-router-dom";
import { useMySocietyInterest } from "@/hooks/useHigherSelfSociety";
import heroImg from "@/assets/society/heart.jpg.asset.json";

/** Dashboard invitation to the Higher Self Society reading circle. */
export function HigherSelfSocietyCard() {
  const { data: mine } = useMySocietyInterest();
  return (
    <Link
      to="/rituals/higher-self-society"
      className="society-theme relative block overflow-hidden rounded-lg border border-[hsl(var(--society-line)/0.6)]"
    >
      <img src={heroImg.url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="relative p-6">
        <p className="uppercase tracking-[0.3em] text-[10px] text-[hsl(var(--society-gold))]">New member ritual</p>
        <h3 className="font-serif text-2xl mt-2">The Higher Self Society</h3>
        <p className="text-sm mt-2 text-[hsl(var(--society-muted))]">
          {mine
            ? "You're on the founding roster. Tap to update your preferences."
            : "A monthly reading circle for members. Join the founding circle and help choose our first book."}
        </p>
        <span className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--society-gold))]">
          {mine ? "View my preferences →" : "Join the circle →"}
        </span>
      </div>
    </Link>
  );
}
