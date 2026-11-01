import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEventVoteTallies } from "@/hooks/useEventVote";
import { SOCIETY_BOOKS, SOCIETY_BOOK_VOTE_SLUG } from "@/lib/societyBooks";
import { neutralizeCsvFormula as csvSafe } from "@/lib/csvSafe";
import { format } from "date-fns";

const titleOf = (k: string) => SOCIETY_BOOKS.find((b) => b.key === k)?.title ?? k;

function downloadCsv(name: string, header: string[], rows: any[][]) {
  const body = rows.map((r) => r.map((v) => `"${String(csvSafe(v ?? "")).replace(/"/g, '""')}"`).join(","));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" }));
  a.download = name;
  a.click();
}

export function SocietyBookVoteAdmin() {
  const { data: tallies = [] } = useEventVoteTallies(SOCIETY_BOOK_VOTE_SLUG);
  const { data: votes = [] } = useQuery({
    queryKey: ["hss-book-votes-admin"],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_votes").select("user_id, option_key, updated_at")
        .eq("event_slug", SOCIETY_BOOK_VOTE_SLUG).order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((v) => v.user_id);
      const { data: roster } = ids.length
        ? await supabase.from("higher_self_society_interest").select("user_id, full_name, email").in("user_id", ids)
        : { data: [] as any[] };
      const m = new Map((roster ?? []).map((r: any) => [r.user_id, r]));
      return (data ?? []).map((v) => ({ ...v, name: m.get(v.user_id)?.full_name ?? "—", email: m.get(v.user_id)?.email ?? "" }));
    },
  });
  const [filter, setFilter] = useState<"all" | "member" | "non">("all");
  const { data: nextRound = [] } = useQuery({
    queryKey: ["hss-next-round"],
    queryFn: async () => {
      const { data, error } = await supabase.from("society_next_round_interest" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const emails = [...new Set(rows.map((r) => String(r.email ?? "").trim().toLowerCase()).filter(Boolean))];
      const memberEmails = new Set<string>();
      for (let i = 0; i < emails.length; i += 200) {
        const { data: ms } = await supabase.from("members").select("email, status")
          .in("email", emails.slice(i, i + 200)).neq("status", "cancelled");
        (ms ?? []).forEach((m: any) => memberEmails.add(String(m.email).toLowerCase()));
      }
      // Fallback for mixed-case stored emails
      const { data: ilikeMs } = emails.length && memberEmails.size < emails.length
        ? await supabase.from("members").select("email").neq("status", "cancelled")
            .or(emails.filter((e) => !memberEmails.has(e)).map((e) => `email.ilike.${e.replace(/[,()]/g, "")}`).join(","))
        : { data: [] as any[] };
      (ilikeMs ?? []).forEach((m: any) => memberEmails.add(String(m.email).toLowerCase()));
      return rows.map((r) => ({ ...r, isMember: memberEmails.has(String(r.email ?? "").trim().toLowerCase()) }));
    },
  });
  const shown = nextRound.filter((r: any) => filter === "all" || (filter === "member") === r.isMember);

  const total = tallies[0]?.total_votes ?? 0;
  const ranked = SOCIETY_BOOKS.map((b) => ({ ...b, n: tallies.find((t) => t.option_key === b.key)?.vote_count ?? 0 }))
    .sort((a, b) => b.n - a.n);

  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Book vote · {total} vote{total === 1 ? "" : "s"}</CardTitle>
          <Button size="sm" variant="outline" disabled={!votes.length}
            onClick={() => downloadCsv("hss-book-votes.csv", ["Name", "Email", "Book", "Voted"],
              votes.map((v: any) => [v.name, v.email, titleOf(v.option_key), v.updated_at]))}>Export CSV</Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ranked.map((b, i) => (
            <div key={b.key}>
              <div className="flex justify-between gap-2"><span className={i === 0 && b.n > 0 ? "font-semibold" : ""}>{b.title}</span><b>{b.n}</b></div>
              <Progress value={total ? (b.n / total) * 100 : 0} className="h-1.5 mt-1" />
            </div>
          ))}
          <div className="border-t pt-3 space-y-1 max-h-64 overflow-auto">
            {!votes.length && <p className="text-muted-foreground">No votes yet.</p>}
            {votes.map((v: any) => (
              <div key={v.user_id} className="flex justify-between gap-2">
                <span className="truncate">{v.name}<span className="text-muted-foreground"> · {titleOf(v.option_key)}</span></span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(v.updated_at), "MMM d, h:mm a")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
          <CardTitle className="text-sm">Next round list · {shown.length}</CardTitle>
          <div className="flex gap-1">
            {(["all", "member", "non"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "member" ? "Members" : "Non-members"}
              </Button>
            ))}
            <Button size="sm" variant="outline" disabled={!shown.length}
              onClick={() => downloadCsv("hss-next-round.csv", ["Name", "Email", "Phone", "Type", "Added"],
                shown.map((r) => [r.full_name, r.email, r.phone, r.isMember ? "Member" : "Non-member", r.created_at]))}>Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-1 max-h-96 overflow-auto">
          {!shown.length && <p className="text-muted-foreground">No one yet.</p>}
          {shown.map((r) => (
            <div key={r.id} className="flex justify-between gap-2 items-center">
              <span className="truncate">{r.full_name}<span className="text-muted-foreground"> · {r.email}{r.phone && ` · ${r.phone}`}</span></span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Badge variant={r.isMember ? "default" : "outline"}>{r.isMember ? "Member" : "Non-member"}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d")}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
