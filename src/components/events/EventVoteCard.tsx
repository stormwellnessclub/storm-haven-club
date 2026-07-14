import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Check, Calendar, Clock, ChevronDown, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { SOUND_BATH_VOTE, isVoteOpen } from "@/lib/eventVote";
import {
  useEventVoteTallies,
  useMyEventVote,
  useCastVote,
} from "@/hooks/useEventVote";

interface Props {
  voterType: "member" | "non_member";
}

export function EventVoteCard({ voterType }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tallies = [] } = useEventVoteTallies(SOUND_BATH_VOTE.slug);
  const { data: myVote } = useMyEventVote(SOUND_BATH_VOTE.slug);
  const castVote = useCastVote(SOUND_BATH_VOTE.slug, voterType);

  const open = isVoteOpen();
  const totalVotes = tallies[0]?.total_votes ?? 0;

  const tallyByKey = useMemo(() => {
    const map: Record<string, VoteRow> = {};
    for (const t of tallies) map[t.option_key] = t;
    return map;
  }, [tallies]);

  // Deep link from email: /?vote=<slug>&choice=<key>
  useEffect(() => {
    const slug = searchParams.get("vote");
    const choice = searchParams.get("choice");
    if (slug === SOUND_BATH_VOTE.slug && choice && open && !myVote) {
      const el = document.getElementById(`vote-${choice}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear params to avoid re-triggering
      const next = new URLSearchParams(searchParams);
      next.delete("vote");
      next.delete("choice");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, open, myVote, setSearchParams]);

  const closesLabel = format(new Date(SOUND_BATH_VOTE.closesAt), "EEE, MMM d");
  const price = voterType === "member" ? SOUND_BATH_VOTE.pricing.member : SOUND_BATH_VOTE.pricing.nonMember;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          Member Vote
        </div>
        <CardTitle className="text-xl sm:text-2xl leading-tight mt-1">
          {SOUND_BATH_VOTE.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{SOUND_BATH_VOTE.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          {SOUND_BATH_VOTE.description.slice(0, 2).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <details className="mt-2">
            <summary className="cursor-pointer text-primary text-xs font-medium hover:underline">
              Read full description
            </summary>
            <div className="mt-2 space-y-2">
              {SOUND_BATH_VOTE.description.slice(2).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </details>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Members ${SOUND_BATH_VOTE.pricing.member}</Badge>
          <Badge variant="secondary">Non-Members ${SOUND_BATH_VOTE.pricing.nonMember}</Badge>
          <Badge variant="outline">You: ${price}</Badge>
          <Badge variant="outline">90 minutes</Badge>
        </div>

        <div className="space-y-3">
          {SOUND_BATH_VOTE.options.map((opt) => {
            const t = tallyByKey[opt.key];
            const pct = t?.percentage ?? 0;
            const isMine = myVote?.option_key === opt.key;
            return (
              <button
                id={`vote-${opt.key}`}
                key={opt.key}
                type="button"
                disabled={!open || castVote.isPending}
                onClick={() => castVote.mutate(opt.key)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  isMine
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                } ${!open ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {isMine ? <Check className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm sm:text-base">{opt.label}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {opt.time}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold tabular-nums">{pct.toFixed(0)}%</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t?.vote_count ?? 0} vote{(t?.vote_count ?? 0) === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <Progress value={pct} className="h-2 mt-3" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            {open ? (
              myVote ? (
                <>You voted for <strong>{labelForKey(myVote.option_key)}</strong>. Tap the other to change.</>
              ) : (
                <>Tap an evening to cast your vote.</>
              )
            ) : (
              <>Voting closed. Results coming soon.</>
            )}
          </span>
          <span>{totalVotes} total {open && <>· closes {closesLabel}</>}</span>
        </div>
      </CardContent>
    </Card>
  );
}

type VoteRow = { option_key: string; vote_count: number; total_votes: number; percentage: number | null };

function labelForKey(key: string) {
  return SOUND_BATH_VOTE.options.find((o) => o.key === key)?.label ?? key;
}
