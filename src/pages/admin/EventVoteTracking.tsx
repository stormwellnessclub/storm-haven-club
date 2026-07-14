import { useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SOUND_BATH_VOTE } from "@/lib/eventVote";
import { useEventVoteTallies } from "@/hooks/useEventVote";
import { format } from "date-fns";
import { Download, Users } from "lucide-react";
import { SendVoteBlastButton } from "@/components/admin/SendVoteBlastButton";

export default function EventVoteTracking() {
  const slug = SOUND_BATH_VOTE.slug;
  const { data: tallies = [] } = useEventVoteTallies(slug);

  const { data: votes = [], isLoading } = useQuery({
    queryKey: ["admin-event-votes", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_votes")
        .select("id, option_key, voter_type, created_at, updated_at, user_id")
        .eq("event_slug", slug)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((v: any) => v.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", ids);
      const map = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((v: any) => ({ ...v, profile: map.get(v.user_id) }));
    },
    refetchInterval: 20000,
  });

  const stats = useMemo(() => {
    const total = tallies[0]?.total_votes ?? 0;
    const memberCount = votes.filter((v: any) => v.voter_type === "member").length;
    const nonMemberCount = votes.filter((v: any) => v.voter_type === "non_member").length;
    return { total, memberCount, nonMemberCount };
  }, [tallies, votes]);

  const exportCsv = () => {
    const header = ["Name", "Email", "Voter Type", "Choice", "Voted At"];
    const rows = votes.map((v: any) => [
      `${v.profile?.first_name ?? ""} ${v.profile?.last_name ?? ""}`.trim(),
      v.profile?.email ?? "",
      v.voter_type,
      SOUND_BATH_VOTE.options.find((o) => o.key === v.option_key)?.label ?? v.option_key,
      new Date(v.updated_at).toISOString(),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sound-bath-vote-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Event Vote: Sound Bath</h1>
            <p className="text-sm text-muted-foreground">
              Voting closes {format(new Date(SOUND_BATH_VOTE.closesAt), "EEEE, MMM d yyyy")}
            </p>
          </div>
          <div className="flex gap-2">
            <SendVoteBlastButton />
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total votes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.memberCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Non-Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.nonMemberCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Live tally</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {SOUND_BATH_VOTE.options.map((opt) => {
              const t = tallies.find((x) => x.option_key === opt.key);
              const pct = t?.percentage ?? 0;
              return (
                <div key={opt.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">
                      {opt.label} · {opt.time}
                    </span>
                    <span className="tabular-nums">
                      {t?.vote_count ?? 0} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-3" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Individual votes</CardTitle>
            <Badge variant="outline">
              <Users className="h-3 w-3 mr-1" /> {votes.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : votes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No votes yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Choice</TableHead>
                      <TableHead>Voted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {votes.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          {`${v.profile?.first_name ?? ""} ${v.profile?.last_name ?? ""}`.trim() || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{v.profile?.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={v.voter_type === "member" ? "default" : "secondary"}>
                            {v.voter_type === "member" ? "Member" : "Non-Member"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {SOUND_BATH_VOTE.options.find((o) => o.key === v.option_key)?.label ?? v.option_key}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(v.updated_at), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
