import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCastVote, useEventVoteTallies, useMyEventVote } from "@/hooks/useEventVote";
import { SOCIETY_BOOKS, SOCIETY_BOOK_VOTE_SLUG, coverUrl } from "@/lib/societyBooks";

const gold = "text-[hsl(var(--society-gold))]";
const muted = "text-[hsl(var(--society-muted))]";
const field =
  "w-full bg-[hsl(var(--society-bg))] border border-[hsl(var(--society-line))] rounded-sm px-4 py-3 text-[hsl(var(--society-cream))] placeholder:text-[hsl(var(--society-muted))] focus:outline-none focus:border-[hsl(var(--society-gold))]";

function Cover({ isbn, title }: { isbn: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="w-24 sm:w-28 aspect-[2/3] shrink-0 border border-[hsl(var(--society-line))] flex items-center justify-center p-2 text-center font-serif text-xs">
        {title}
      </div>
    );
  return (
    <img
      src={coverUrl(isbn)}
      alt={`Cover of ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-24 sm:w-28 aspect-[2/3] object-cover shrink-0 rounded-sm shadow-lg"
    />
  );
}

export function SocietyBookVote() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tallies = [] } = useEventVoteTallies(SOCIETY_BOOK_VOTE_SLUG);
  const { data: myVote } = useMyEventVote(SOCIETY_BOOK_VOTE_SLUG);
  const cast = useCastVote(SOCIETY_BOOK_VOTE_SLUG, "member");
  const [open, setOpen] = useState<string | null>(null);

  const { data: eligible, isLoading } = useQuery({
    queryKey: ["hss-vote-eligible", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_society_roster_member" as any, { _uid: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const total = tallies[0]?.total_votes ?? 0;
  const countFor = (k: string) => tallies.find((t) => t.option_key === k)?.vote_count ?? 0;
  const canVote = !!user && eligible === true;

  return (
    <section id="book-vote" className="container mx-auto px-4 sm:px-6 py-16 max-w-4xl border-b border-[hsl(var(--society-line)/0.5)]">
      <p className={`uppercase tracking-[0.35em] text-xs text-center ${gold}`}>Choose our first book</p>
      <h2 className="font-serif text-3xl sm:text-4xl text-center mt-3">The Book Vote</h2>
      <p className={`text-center mt-3 ${muted}`}>
        {canVote
          ? myVote
            ? "Thank you for voting. You can change your choice anytime."
            : "Pick the one title you would most like to read together."
          : "Voting is reserved for members of the reading circle."}
        {total > 0 && ` · ${total} vote${total === 1 ? "" : "s"} so far`}
      </p>

      {!canVote && !isLoading && <NextRoundPanel signedIn={!!user} />}

      <ul className="mt-10 space-y-5">
        {SOCIETY_BOOKS.map((b) => {
          const mine = myVote?.option_key === b.key;
          const n = countFor(b.key);
          const pct = total ? Math.round((n / total) * 100) : 0;
          const expanded = open === b.key;
          return (
            <li
              key={b.key}
              className={`flex gap-4 sm:gap-6 p-4 sm:p-5 rounded-sm border ${mine ? "border-[hsl(var(--society-gold))]" : "border-[hsl(var(--society-line))]"}`}
            >
              <Cover isbn={b.isbn} title={b.title} />
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="font-serif text-xl sm:text-2xl leading-snug">{b.title}</h3>
                <p className={`text-sm mt-1 ${gold}`}>{b.author}</p>
                <p className={`mt-2 text-sm leading-relaxed ${muted} ${expanded ? "" : "line-clamp-3 sm:line-clamp-none"}`}>{b.synopsis}</p>
                <button type="button" onClick={() => setOpen(expanded ? null : b.key)} className={`sm:hidden self-start text-xs mt-1 underline ${gold}`}>
                  {expanded ? "Show less" : "Read more"}
                </button>
                <div className="mt-auto pt-4 flex flex-wrap items-center gap-3">
                  {canVote && (
                    <button
                      type="button"
                      disabled={cast.isPending || mine}
                      onClick={() => cast.mutate(b.key)}
                      className={`min-h-11 px-5 rounded-sm text-sm tracking-wide border transition ${
                        mine
                          ? "bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))] border-[hsl(var(--society-gold))]"
                          : "border-[hsl(var(--society-gold))] hover:bg-[hsl(var(--society-gold)/0.15)]"
                      }`}
                    >
                      {mine ? <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" /> Your vote</span> : myVote ? "Change to this book" : "Vote for this book"}
                    </button>
                  )}
                  {total > 0 && <span className={`text-xs ${muted}`}>{n} vote{n === 1 ? "" : "s"} · {pct}%</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );

  function NextRoundPanel({ signedIn }: { signedIn: boolean }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState(user?.email ?? "");
    const [phone, setPhone] = useState("");
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !email.trim()) return toast.error("Please add your name and email.");
      setBusy(true);
      const { error } = await supabase.from("society_next_round_interest" as any).insert({
        full_name: name.trim().slice(0, 120), email: email.trim().toLowerCase().slice(0, 255),
        phone: phone.trim().slice(0, 30) || null, user_id: user?.id ?? null,
      });
      setBusy(false);
      if (error && error.code !== "23505") return toast.error("We couldn't save that. Please try again.");
      setDone(true);
      qc.invalidateQueries({ queryKey: ["hss-next-round"] });
    };
    return (
      <div className="mt-8 p-5 sm:p-6 border border-[hsl(var(--society-line))] rounded-sm">
        <h3 className={`font-serif text-2xl ${gold}`}>Add your name to the next round</h3>
        <p className={`mt-2 text-sm ${muted}`}>
          Not in the reading circle yet? Leave your details and we'll reach out when the next circle opens.
          {!signedIn && <> Already signed up? <Link to="/auth?redirect=/rituals/higher-self-society" className="underline">Sign in to vote</Link>.</>}
        </p>
        {done ? (
          <p className="mt-4">You're on the list. We'll be in touch.</p>
        ) : (
          <form onSubmit={submit} className="mt-4 grid sm:grid-cols-3 gap-3">
            <input className={field} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
            <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="email" />
            <input className={field} type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
            <button disabled={busy} className="sm:col-span-3 min-h-11 bg-[hsl(var(--society-gold))] text-[hsl(var(--society-bg))] rounded-sm tracking-wide">
              {busy ? "Saving…" : "Add my name"}
            </button>
          </form>
        )}
      </div>
    );
  }
}
