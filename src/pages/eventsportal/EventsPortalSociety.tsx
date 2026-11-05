import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SocietyRsvpAdmin } from "@/components/eventsportal/SocietyRsvpAdmin";
import { SOCIETY_ROUNDS } from "@/lib/societyBooks";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SOCIETY_RHYTHMS, useSocietyRoster, useUpdateGuestStatus, useAdminRemoveSocietyPerson } from "@/hooks/useHigherSelfSociety";
import { SocietyInviteEmailControls } from "@/components/eventsportal/SocietyInviteEmailControls";
import { SocietyLastCallControls } from "@/components/eventsportal/SocietyLastCallControls";
import { SocietyAddPersonPanel } from "@/components/eventsportal/SocietyAddPersonPanel";
import { SocietyGuestApprovePanel } from "@/components/eventsportal/SocietyGuestApprovePanel";
import { neutralizeCsvFormula as csvSafe } from "@/lib/csvSafe";
import { SocietyBookVoteAdmin } from "@/components/eventsportal/SocietyBookVoteAdmin";
import { SocietyRoundSignups } from "@/components/eventsportal/SocietyRoundSignups";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function EventsPortalSociety() {
  const { data: rows = [], isLoading } = useSocietyRoster();
  const update = useUpdateGuestStatus();
  const remove = useAdminRemoveSocietyPerson();
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get("round") ?? SOCIETY_ROUNDS[SOCIETY_ROUNDS.length - 1].key;
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const roundOf = (r: any) => r.joined_round_key ?? SOCIETY_ROUNDS[0].key;
  const roundLabelOf = (r: any) => SOCIETY_ROUNDS.find((x) => x.key === roundOf(r))?.label ?? SOCIETY_ROUNDS[0].label;
  const visibleRows = roundFilter === "all" ? rows : rows.filter((r: any) => roundOf(r) === roundFilter);

  const doRemove = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success("Removed from the roster");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove");
    } finally {
      setConfirmId(null);
    }
  };

  const rhythmCounts = SOCIETY_RHYTHMS.map((r) => ({
    ...r,
    n: rows.filter((x: any) => x.preferred_rhythm === r.value).length,
  }));
  const themeCounts: Record<string, number> = {};
  rows.forEach((r: any) => (r.themes ?? []).forEach((t: string) => (themeCounts[t] = (themeCounts[t] ?? 0) + 1)));

  const exportCsv = () => {
    const header = ["Name", "Email", "Phone", "Type", "Added by", "Tier", "Founding", "Evening", "Themes", "Book", "Why", "Guest", "Guest status", "Staff note", "Joined"];
    const lines = rows.map((r: any) =>
      [r.full_name, r.email, r.phone, r.is_member === false ? "Non-member" : "Member", r.source === "staff" ? "Staff" : "Self",
       r.membership_type, r.is_founding ? "Yes" : "No", r.preferred_rhythm, (r.themes ?? []).join("; "),
       r.book_suggestion, r.book_reason, r.guest_name, r.guest_status, r.staff_note, r.created_at]
        .map((v) => `"${String(csvSafe(v ?? "")).replace(/"/g, '""')}"`).join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "higher-self-society-roster.csv";
    a.click();
  };

  const setGuest = async (id: string, guest_status: string) => {
    try {
      await update.mutateAsync({ id, guest_status });
      toast.success(`Guest ${guest_status}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not update");
    }
  };

  return (
    <EventsPortalShell title="Higher Self Society" description="Members, rounds and RSVPs. Emails and texts live in Campaign Studio.">
      <a href="/admin/campaign-studio?event=higher_self_society" className="mb-4 inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
        Open Higher Self Society campaigns
      </a>

      <Tabs value={tab} onValueChange={(v) => setParams(v === "members" ? {} : { round: v }, { replace: true })}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="members">Members</TabsTrigger>
          {SOCIETY_ROUNDS.map((r) => <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value={SOCIETY_ROUNDS[0].key}>
          <SocietyRsvpAdmin round={SOCIETY_ROUNDS[0]} roster={rows} />
          <SocietyBookVoteAdmin />
          <div className="space-y-6 pt-6">
            <SocietyLastCallControls audience="book_winner" />
            <SocietyLastCallControls audience="rsvp_reminder" />
            <SocietyLastCallControls audience="book_vote_reminder" />
            <SocietyLastCallControls audience="book_vote" />
          </div>
        </TabsContent>

        <TabsContent value={SOCIETY_ROUNDS[1].key}>
          <p className="text-sm text-muted-foreground mb-4">Voting closes {SOCIETY_ROUNDS[1].voteClosesLabel}. The ballot is added once the book list is ready. Meeting: {SOCIETY_ROUNDS[1].meetingLabel}.</p>
          <SocietyRoundSignups rows={rows} roundKey={SOCIETY_ROUNDS[1].key} roundLabel={SOCIETY_ROUNDS[1].label} />
          <Collapsible>
            <CollapsibleTrigger asChild><Button variant="outline" size="sm">Messages for this round</Button></CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-6">
              <SocietyLastCallControls audience="stay_next_round" />
              <SocietyLastCallControls audience="next_round" />
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        <TabsContent value="members">
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Founding roster</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{rows.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Preferred evening</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">{rhythmCounts.map((r) => <div key={r.value} className="flex justify-between"><span>{r.label}</span><b>{r.n}</b></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Top themes</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">{Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => <div key={t} className="flex justify-between"><span>{t}</span><b>{n}</b></div>)}</CardContent></Card>
      </div>
      <div className="flex justify-between items-center mb-3 gap-2">
        <h2 className="font-semibold">Roster</h2>
        <div className="flex gap-2">
          <select value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="all">All rounds</option>
            {SOCIETY_ROUNDS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <Button size="sm" onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add person"}</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </div>
      </div>
      {adding && <SocietyAddPersonPanel onDone={() => setAdding(false)} />}
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr>
            <th className="p-2">Person</th><th className="p-2">Tier</th><th className="p-2">Evening</th>
            <th className="p-2">Book suggestion</th><th className="p-2">Guest</th><th className="p-2"></th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={6}>Loading…</td></tr>}
            {!isLoading && !rows.length && <tr><td className="p-3 text-muted-foreground" colSpan={6}>No sign-ups yet.</td></tr>}
            {visibleRows.map((r: any) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">
                  <div className="font-medium">{r.full_name} <Badge variant="outline" className="ml-1">{roundLabelOf(r)}</Badge></div>
                  <div className="text-xs text-muted-foreground">{r.email}{r.phone && ` · ${r.phone}`}</div>
                  <div className="flex gap-1 mt-1">
                    <Badge variant={r.is_member === false ? "outline" : "secondary"}>{r.is_member === false ? "Non-member" : "Member"}</Badge>
                    {r.source === "staff" && <Badge variant="outline">Added by staff</Badge>}
                    {r.source === "guest" && <Badge variant="outline">Approved guest</Badge>}
                  </div>
                  {r.staff_note && <div className="text-xs text-muted-foreground mt-1 italic">{r.staff_note}</div>}
                </td>
                <td className="p-2">{r.membership_type}{r.is_founding && <Badge variant="secondary" className="ml-1">Founding</Badge>}</td>
                <td className="p-2">{SOCIETY_RHYTHMS.find((x) => x.value === r.preferred_rhythm)?.label ?? "—"}</td>
                <td className="p-2 max-w-xs">{r.book_suggestion || "—"}{r.book_reason && <div className="text-xs text-muted-foreground mt-1">{r.book_reason}</div>}</td>
                <td className="p-2">
                  {r.guest_requested ? (
                    <div className="space-y-1">
                      <div>{r.guest_name || "Guest"} <Badge variant="outline">{r.guest_status}</Badge></div>
                      {r.guest_status === "pending" && (approvingId === r.id ? (
                        <SocietyGuestApprovePanel hostId={r.id} onDone={() => setApprovingId(null)} />
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => setApprovingId(r.id)}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setGuest(r.id, "declined")}>Decline</Button>
                        </div>
                      ))}
                    </div>
                  ) : "—"}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  {confirmId === r.id ? (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => doRemove(r.id)}>Confirm remove</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Keep</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(r.id)}>Remove</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-6">
        <SocietyLastCallControls />
      </div>
      <div className="pt-6">
        <h2 className="font-semibold mb-3">Invitation email</h2>
        <SocietyInviteEmailControls />
      </div>
        </TabsContent>
      </Tabs>
    </EventsPortalShell>
  );
}
