import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SOCIETY_RHYTHMS, useSocietyRoster, useUpdateGuestStatus } from "@/hooks/useHigherSelfSociety";
import { SocietyInviteEmailControls } from "@/components/eventsportal/SocietyInviteEmailControls";
import { neutralizeCsvFormula as csvSafe } from "@/lib/csvSafe";

export default function EventsPortalSociety() {
  const { data: rows = [], isLoading } = useSocietyRoster();
  const update = useUpdateGuestStatus();

  const rhythmCounts = SOCIETY_RHYTHMS.map((r) => ({
    ...r,
    n: rows.filter((x: any) => x.preferred_rhythm === r.value).length,
  }));
  const themeCounts: Record<string, number> = {};
  rows.forEach((r: any) => (r.themes ?? []).forEach((t: string) => (themeCounts[t] = (themeCounts[t] ?? 0) + 1)));

  const exportCsv = () => {
    const header = ["Name", "Email", "Tier", "Founding", "Evening", "Themes", "Book", "Why", "Guest", "Guest status", "Joined"];
    const lines = rows.map((r: any) =>
      [r.full_name, r.email, r.membership_type, r.is_founding ? "Yes" : "No", r.preferred_rhythm, (r.themes ?? []).join("; "),
       r.book_suggestion, r.book_reason, r.guest_name, r.guest_status, r.created_at]
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
    <EventsPortalShell title="Higher Self Society">
      <SocietyInviteEmailControls />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Founding roster</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{rows.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Preferred evening</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">{rhythmCounts.map((r) => <div key={r.value} className="flex justify-between"><span>{r.label}</span><b>{r.n}</b></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Top themes</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">{Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => <div key={t} className="flex justify-between"><span>{t}</span><b>{n}</b></div>)}</CardContent></Card>
      </div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">Roster</h2>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr>
            <th className="p-2">Member</th><th className="p-2">Tier</th><th className="p-2">Evening</th>
            <th className="p-2">Book suggestion</th><th className="p-2">Guest</th></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={5}>Loading…</td></tr>}
            {!isLoading && !rows.length && <tr><td className="p-3 text-muted-foreground" colSpan={5}>No sign-ups yet.</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2"><div className="font-medium">{r.full_name}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                <td className="p-2">{r.membership_type}{r.is_founding && <Badge variant="secondary" className="ml-1">Founding</Badge>}</td>
                <td className="p-2">{SOCIETY_RHYTHMS.find((x) => x.value === r.preferred_rhythm)?.label ?? "—"}</td>
                <td className="p-2 max-w-xs">{r.book_suggestion || "—"}{r.book_reason && <div className="text-xs text-muted-foreground mt-1">{r.book_reason}</div>}</td>
                <td className="p-2">
                  {r.guest_requested ? (
                    <div className="space-y-1">
                      <div>{r.guest_name || "Guest"} <Badge variant="outline">{r.guest_status}</Badge></div>
                      {r.guest_status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => setGuest(r.id, "approved")}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setGuest(r.id, "declined")}>Decline</Button>
                        </div>
                      )}
                    </div>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </EventsPortalShell>
  );
}
