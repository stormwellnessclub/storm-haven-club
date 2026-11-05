import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { neutralizeCsvFormula as csvSafe } from "@/lib/csvSafe";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Detroit" }) : "—";

export function SocietyRoundSignups({ rows, roundKey, roundLabel }: { rows: any[]; roundKey: string; roundLabel: string }) {
  const [q, setQ] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const joined = useMemo(() => rows.filter((r) => r.joined_round_key === roundKey), [rows, roundKey]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return joined
      .filter((r) => !s || [r.full_name, r.email, r.phone, r.book_suggestion].some((v) => String(v ?? "").toLowerCase().includes(s)))
      .sort((a, b) => (newestFirst ? -1 : 1) * String(a.joined_round_at ?? "").localeCompare(String(b.joined_round_at ?? "")));
  }, [joined, q, newestFirst]);

  const members = joined.filter((r) => r.is_member !== false).length;
  const stats = [
    { label: "Signed up", n: joined.length },
    { label: "Members", n: members },
    { label: "Guests / non-members", n: joined.length - members },
    { label: "Book picks", n: joined.filter((r) => r.book_suggestion).length },
  ];

  const download = () => {
    const header = ["Name", "Email", "Phone", "Type", "Joined", "Book pick", "Why"];
    const lines = shown.map((r) =>
      [r.full_name, r.email, r.phone, r.is_member === false ? "Non-member" : "Member", fmtDate(r.joined_round_at), r.book_suggestion, r.book_reason]
        .map((v) => `"${String(csvSafe(v ?? "")).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `higher-self-society-${roundKey}-signups.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold">{s.n}</div>
          </CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{roundLabel} sign-ups ({joined.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, book" className="h-8 w-56" />
            <Button size="sm" variant="outline" onClick={() => setNewestFirst((v) => !v)}>{newestFirst ? "Newest first" : "Oldest first"}</Button>
            <Button size="sm" variant="outline" onClick={download} disabled={!shown.length}>Download list</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">Person</th><th className="p-2">Type</th><th className="p-2">Joined</th><th className="p-2">Book pick</th>
            </tr></thead>
            <tbody>
              {!shown.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">{joined.length ? "No matches." : "No sign-ups yet."}</td></tr>}
              {shown.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2"><div className="font-medium">{r.full_name || r.email}</div>
                    <div className="text-xs text-muted-foreground">{r.email}{r.phone && ` · ${r.phone}`}</div></td>
                  <td className="p-2"><Badge variant={r.is_member === false ? "outline" : "secondary"}>{r.is_member === false ? "Non-member" : "Member"}</Badge></td>
                  <td className="p-2 whitespace-nowrap">{fmtDate(r.joined_round_at)}</td>
                  <td className="p-2 max-w-sm">{r.book_suggestion || "—"}{r.book_reason && <div className="text-xs text-muted-foreground mt-1">{r.book_reason}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
