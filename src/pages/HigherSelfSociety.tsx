import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMembership } from "@/hooks/useUserMembership";
import {
  SOCIETY_RHYTHMS,
  SOCIETY_THEMES,
  useMySocietyInterest,
  useSubmitSocietyInterest,
} from "@/hooks/useHigherSelfSociety";
import heroImg from "@/assets/society/shelf.jpg.asset.json";
import quoteImg from "@/assets/society/quote.jpg.asset.json";
import pagesImg from "@/assets/society/pages.jpg.asset.json";
import heartImg from "@/assets/society/heart.jpg.asset.json";
import botanicalImg from "@/assets/society/botanical.jpg.asset.json";

const gold = "text-[hsl(var(--society-gold))]";
const muted = "text-[hsl(var(--society-muted))]";
const field =
  "w-full bg-[hsl(var(--society-bg))] border border-[hsl(var(--society-line))] rounded-sm px-4 py-3 text-[hsl(var(--society-cream))] placeholder:text-[hsl(var(--society-muted))] focus:outline-none focus:border-[hsl(var(--society-gold))]";

export default function HigherSelfSociety() {
  const { user } = useAuth();
  const { data: membership, isLoading: memLoading } = useUserMembership();
  const { data: mine } = useMySocietyInterest();
  const submit = useSubmitSocietyInterest();

  const [themes, setThemes] = useState<string[]>([]);
  const [rhythm, setRhythm] = useState("either");
  const [book, setBook] = useState("");
  const [reason, setReason] = useState("");
  const [guest, setGuest] = useState(false);
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    if (!mine) return;
    setThemes(mine.themes ?? []);
    setRhythm(mine.preferred_rhythm ?? "either");
    setBook(mine.book_suggestion ?? "");
    setReason(mine.book_reason ?? "");
    setGuest(!!mine.guest_requested);
    setGuestName(mine.guest_name ?? "");
  }, [mine]);

  const isMember =
    !!membership && ["active", "frozen", "past_due"].includes(membership.status);
  const guestAllowed =
    isMember &&
    (!!membership?.is_founding_member || /diamond/i.test(membership?.membership_type ?? ""));

  const toggle = (t: string) =>
    setThemes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submit.mutateAsync({ themes, rhythm, book, reason, guest, guestName });
      toast.success(mine ? "Your preferences are updated." : "Welcome to the founding circle.");
    } catch (err: any) {
      toast.error(err?.message || "We couldn't save that. Please try again.");
    }
  };

  return (
    <Layout>
      <div className="society-theme">
        {/* Opening */}
        <section className="relative min-h-[70vh] flex items-end overflow-hidden">
          <img
            src={heroImg.url}
            alt="Shelves of leather-bound books"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--society-bg))] via-[hsl(var(--society-bg)/0.6)] to-transparent" />
          <div className="relative container mx-auto px-6 pb-16 max-w-3xl">
            <p className={`uppercase tracking-[0.35em] text-xs ${gold}`}>A Storm Member Ritual</p>
            <h1 className="font-serif text-5xl md:text-7xl mt-4 leading-tight">The Higher Self Society</h1>
            <p className={`mt-6 text-lg md:text-xl font-serif italic ${muted}`}>
              An intimate reading circle for members who read to grow — one book, one evening a month, and
              the conversations that stay with you long after.
            </p>
          </div>
        </section>

        {/* What to expect */}
        <section className="container mx-auto px-6 py-16 max-w-5xl grid md:grid-cols-3 gap-10 border-b border-[hsl(var(--society-line)/0.5)]">
          {[
            ["Monthly gathering", "One carefully chosen book, discussed by candlelight in an unhurried evening."],
            ["Members only", "Open to every Storm Wellness Club member. Founding and Diamond members may request a guest seat."],
            ["Shaped by you", "Your themes, preferred evening and book suggestions guide the first season."],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className={`font-serif text-2xl ${gold}`}>{t}</h3>
              <p className={`mt-3 leading-relaxed ${muted}`}>{d}</p>
            </div>
          ))}
        </section>

        {/* Quote & imagery */}
        <section className="container mx-auto px-6 py-20 max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <img src={quoteImg.url} alt="An open book reading: Self love is the highest frequency" className="w-full aspect-[4/5] object-cover rounded-sm" loading="lazy" />
          <div>
            <p className={`uppercase tracking-[0.35em] text-xs ${gold}`}>The spirit of the circle</p>
            <p className="font-serif text-3xl md:text-4xl mt-5 leading-snug italic">
              "A room of people who read to become more fully themselves."
            </p>
            <p className={`mt-6 leading-relaxed ${muted}`}>
              Each month we gather around one book: part reflection, part conversation, all intention. Come as you are, and leave with a new way of seeing.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-1 md:gap-2 px-1 md:px-2">
          {[[pagesImg, "Open pages scattered together"], [heartImg, "Book pages folded into a heart"], [botanicalImg, "Book pages with pressed flowers"]].map(([img, alt]: any) => (
            <img key={alt} src={img.url} alt={alt} className="w-full aspect-square object-cover" loading="lazy" />
          ))}
        </section>

        {/* Form or access message */}
        <section className="container mx-auto px-6 py-20 max-w-2xl">
          <h2 className="font-serif text-4xl text-center">Join the founding circle</h2>
          <p className={`text-center mt-3 ${muted}`}>
            Share a few preferences and we will reach out with the first title and date.
          </p>

          {!user ? (
            <AccessPanel
              title="Reserved for members"
              body="Sign in to your Storm account to join the founding circle."
              cta={{ to: "/auth?redirect=/rituals/higher-self-society", label: "Sign in" }}
              secondary={{ to: "/memberships", label: "Explore membership" }}
            />
          ) : memLoading ? (
            <p className={`text-center mt-10 ${muted}`}>One moment…</p>
          ) : !isMember ? (
            <AccessPanel
              title="A members' ritual"
              body="The Higher Self Society is reserved for Storm Wellness Club members. We would love to welcome you."
              cta={{ to: "/memberships", label: "Explore membership" }}
              secondary={{ to: "/apply", label: "Apply" }}
            />
          ) : (
            <form
              onSubmit={onSubmit}
              className="mt-10 space-y-8 bg-[hsl(var(--society-surface))] border border-[hsl(var(--society-line)/0.6)] p-8 rounded-sm"
            >
              {mine && (
                <p className={`text-sm ${gold}`}>
                  You're on the founding roster. Update your preferences any time.
                </p>
              )}
              <div>
                <label className="font-serif text-xl">What would you love to read about?</label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SOCIETY_THEMES.map((t) => {
                    const on = themes.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggle(t)}
                        className={`px-4 py-2 text-sm border rounded-full transition-colors ${
                          on
                            ? "bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))] border-[hsl(var(--society-gold))]"
                            : "border-[hsl(var(--society-line))] text-[hsl(var(--society-cream))] hover:border-[hsl(var(--society-gold))]"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-serif text-xl">Which evening suits you?</label>
                <div className="mt-4 space-y-2">
                  {SOCIETY_RHYTHMS.map((r) => (
                    <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="rhythm"
                        checked={rhythm === r.value}
                        onChange={() => setRhythm(r.value)}
                        className="accent-[hsl(var(--society-gold))]"
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="font-serif text-xl block">A book that shifted your perspective</label>
                <input className={field} value={book} maxLength={300} onChange={(e) => setBook(e.target.value)} placeholder="Title and author" />
                <textarea className={field} rows={3} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} placeholder="Why it stayed with you (optional)" />
              </div>

              {guestAllowed && (
                <div className="border-t border-[hsl(var(--society-line)/0.5)] pt-6 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={guest} onChange={(e) => setGuest(e.target.checked)} className="accent-[hsl(var(--society-gold))]" />
                    <span className="font-serif text-xl">Request a guest seat</span>
                  </label>
                  <p className={`text-sm ${muted}`}>
                    A privilege for Founding and Diamond members. Guest seats are confirmed by our team.
                  </p>
                  {guest && (
                    <input className={field} value={guestName} maxLength={120} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest's name" />
                  )}
                  {mine?.guest_status && mine.guest_status !== "none" && (
                    <p className={`text-sm ${gold}`}>Guest request: {mine.guest_status}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submit.isPending}
                className="w-full py-4 uppercase tracking-[0.25em] text-sm bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))] hover:opacity-90 disabled:opacity-50"
              >
                {submit.isPending ? "Saving…" : mine ? "Update my preferences" : "Join the founding circle"}
              </button>
            </form>
          )}
        </section>
      </div>
    </Layout>
  );
}

function AccessPanel({
  title,
  body,
  cta,
  secondary,
}: {
  title: string;
  body: string;
  cta: { to: string; label: string };
  secondary: { to: string; label: string };
}) {
  return (
    <div className="mt-10 text-center bg-[hsl(var(--society-surface))] border border-[hsl(var(--society-line)/0.6)] p-10 rounded-sm">
      <h3 className="font-serif text-3xl">{title}</h3>
      <p className={`mt-3 ${muted}`}>{body}</p>
      <div className="mt-6 flex justify-center gap-4 flex-wrap">
        <Link to={cta.to} className="px-6 py-3 uppercase tracking-[0.2em] text-xs bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))]">
          {cta.label}
        </Link>
        <Link to={secondary.to} className="px-6 py-3 uppercase tracking-[0.2em] text-xs border border-[hsl(var(--society-gold))] text-[hsl(var(--society-gold))]">
          {secondary.label}
        </Link>
      </div>
    </div>
  );
}
