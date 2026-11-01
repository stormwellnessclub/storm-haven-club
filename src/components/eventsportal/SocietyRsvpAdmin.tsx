import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { neutralizeCsvFormula as csvSafe } from "@/lib/csvSafe";
import type { SocietyRound } from "@/lib/societyBooks";

const LABEL: Record<string, string> = { yes: "Yes", maybe: "Maybe", no: "Can't make it", none: "No reply" };

export function SocietyRsvpAdmin({ round, roster }: { round: SocietyRound; roster: any[] }) {
  const [q, setQ] = useState("");
  const { data: rsvps = [] } = useQuery({
    queryKey: ["hss-rsvps-admin", round.key],
    queryFn: async () => {
      const { data, error } = await supabase.from("society_meeting_rsvps").select("user_id, response, updated_at").eq("round_key", round.key);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo(() => {
    const by = new Map(rsvps.map((r: any) => [r.user_id, r]));
    return roster.map((p: any) => ({ name: p.full_name || p.email, email: p.email, phone: p.phone,
      response: (p.user_id && by.get(p.user_id)?.response) || "none", at: p.user_id ? by.get(p.user_id)?.updated_at : null }));
  }, [rsvps, roster]);
  const counts = (k: string) => rows.filter((r) => r.response === k).length;
  const shown = rows.filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));
  const exportCsv = () => {
    const lines = [["Name", "Email", "Phone", "RSVP", "Updated"], ...rows.map((r) => [r.name, r.email, r.phone, LABEL[r.response], r.at])]
      .map((l) => l.map((v) => `"${String(csvSafe(v ?? "")).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `book-club-rsvps-${round.key}.csv`; a.click();
  };
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">RSVPs · {round.meetingLabel}</CardTitle>
        <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          {["yes", "maybe", "no", "none"].map((k) => (
            <div key={k} className="border rounded p-2"><div className="text-2xl font-semibold">{counts(k)}</div><div className="text-xs text-muted-foreground">{LABEL[k]}</div></div>
          ))}
        </div>
        <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-80 overflow-auto border rounded divide-y text-sm">
          {shown.map((r) => (
            <div key={r.email} className="flex items-center gap-2 p-2">
              <span className="flex-1 min-w-0 truncate">{r.name} <span className="text-muted-foreground">· {r.email}</span></span>
              <Badge variant={r.response === "yes" ? "default" : r.response === "none" ? "outline" : "secondary"}>{LABEL[r.response]}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
