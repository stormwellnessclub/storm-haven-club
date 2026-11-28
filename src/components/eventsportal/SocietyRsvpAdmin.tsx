import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { neutralizeCsvFormula as csvSafe } from "@/lib/csvSafe";
import type { SocietyRound } from "@/lib/societyBooks";
import { useSocietyRoundAttendance } from "@/hooks/useSocietyRoundAttendance";
import { SocietyRsvpList, ATTENDANCE_LABEL } from "@/components/events/SocietyRsvpList";

/** Round tab list: only this round's people (shared with event pages via useSocietyRoundAttendance). */
export function SocietyRsvpAdmin({ round }: { round: SocietyRound }) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useSocietyRoundAttendance({ roundKey: round.key });
  const rows = data?.rows ?? [];
  const shown = rows.filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));
  const exportCsv = () => {
    const lines = [["Name", "Email", "Phone", "RSVP", "Rounds"], ...rows.map((r) => [r.name, r.email, r.phone, ATTENDANCE_LABEL[r.status], r.rounds.join(" + ")])]
      .map((l) => l.map((v) => `"${String(csvSafe(v ?? "")).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `higher-self-society-rsvps-${round.key}.csv`; a.click();
  };
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">RSVPs · {round.meetingLabel}</CardTitle>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <SocietyRsvpList rows={shown} showLink={false} />}
      </CardContent>
    </Card>
  );
}
