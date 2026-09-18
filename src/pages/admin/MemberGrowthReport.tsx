import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Info, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useMemberGrowth, type MemberGrowthRow } from "@/hooks/useMemberGrowth";

const monthLabel = (iso: string) => format(parseISO(`${iso.slice(0, 10)}`), "MMM yyyy");

export default function MemberGrowthReport() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: rawRows = [], isLoading, error } = useMemberGrowth(start || undefined, end || undefined);

  // Everything before the February 2026 opening is the pre-sale list that was
  // imported the night before we opened, so it is shown as one "Pre-opening" line
  // rather than as December and January months the club was not open for.
  const rows = useMemo<MemberGrowthRow[]>(() => {
    const pre = rawRows.filter((r) => r.month < "2026-02-01");
    const rest = rawRows.filter((r) => r.month >= "2026-02-01");
    if (!pre.length) return rest;
    const merged: MemberGrowthRow = {
      month: "2026-01-01",
      new_members: pre.reduce((a, r) => a + r.new_members, 0),
      still_active: pre.reduce((a, r) => a + r.still_active, 0),
      frozen: pre.reduce((a, r) => a + r.frozen, 0),
      cancelled: pre.reduce((a, r) => a + r.cancelled, 0),
      legacy_backfilled: pre.reduce((a, r) => a + r.legacy_backfilled, 0),
      with_recorded_payment: pre.reduce((a, r) => a + r.with_recorded_payment, 0),
    };
    return [merged, ...rest];
  }, [rawRows]);

  const rowLabel = (iso: string) => (iso < "2026-02-01" ? "Pre-opening list" : monthLabel(iso));

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        month: rowLabel(r.month),
        newMembers: r.new_members,
        net: r.new_members - r.cancelled,
      })),
    [rows]
  );


  const totals = useMemo(() => {
    const sum = (key: keyof MemberGrowthRow) =>
      rows.reduce((acc, r) => acc + (r[key] as number), 0);
    return {
      newMembers: sum("new_members"),
      stillActive: sum("still_active"),
      frozen: sum("frozen"),
      cancelled: sum("cancelled"),
      legacy: sum("legacy_backfilled"),
      paid: sum("with_recorded_payment"),
    };
  }, [rows]);

  const ytd = useMemo(() => {
    const year = new Date().getFullYear();
    return rows
      .filter((r) => parseISO(r.month).getFullYear() === year)
      .reduce((acc, r) => acc + r.new_members, 0);
  }, [rows]);

  const trailing12 = useMemo(
    () => rows.slice(-12).reduce((acc, r) => acc + r.new_members, 0),
    [rows]
  );

  const downloadCsv = () => {
    const header = [
      "Month",
      "New members",
      "Still active",
      "Frozen",
      "Cancelled since",
      "Net change",
      "Pre-launch records",
      "With recorded payment",
    ];
    const lines = rows.map((r) =>
      [
        rowLabel(r.month),
        r.new_members,
        r.still_active,
        r.frozen,
        r.cancelled,
        r.new_members - r.cancelled,
        r.legacy_backfilled,
        r.with_recorded_payment,
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `member-growth-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Growth Report
            </h1>
            <p className="text-sm text-muted-foreground">
              New members activated each month, with what happened to them since.
            </p>
          </div>
          <Button variant="outline" onClick={downloadCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 pt-6">
            <div className="space-y-1">
              <Label htmlFor="start">From</Label>
              <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">To</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
            >
              All time
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "New members (range)", value: totals.newMembers },
            { label: "Year to date", value: ytd },
            { label: "Last 12 months", value: trailing12 },
            { label: "Still active", value: totals.stillActive },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>New members per month</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend />
                  <Bar name="New members" dataKey="newMembers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line name="Net change" type="monotone" dataKey="net" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Month by month</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">New members</TableHead>
                  <TableHead className="text-right">Still active</TableHead>
                  <TableHead className="text-right">Frozen</TableHead>
                  <TableHead className="text-right">Cancelled since</TableHead>
                  <TableHead className="text-right">Net change</TableHead>
                  <TableHead className="text-right">With recorded payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{rowLabel(r.month)}</TableCell>
                    <TableCell className="text-right">{r.new_members}</TableCell>
                    <TableCell className="text-right">{r.still_active}</TableCell>
                    <TableCell className="text-right">{r.frozen}</TableCell>
                    <TableCell className="text-right">{r.cancelled}</TableCell>
                    <TableCell className="text-right">{r.new_members - r.cancelled}</TableCell>
                    <TableCell className="text-right">
                      {r.with_recorded_payment}
                      {r.with_recorded_payment < r.new_members && (
                        <span className="text-muted-foreground"> / {r.new_members}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && !rows.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No members in this range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableBody>
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totals.newMembers}</TableCell>
                    <TableCell className="text-right">{totals.stillActive}</TableCell>
                    <TableCell className="text-right">{totals.frozen}</TableCell>
                    <TableCell className="text-right">{totals.cancelled}</TableCell>
                    <TableCell className="text-right">{totals.newMembers - totals.cancelled}</TableCell>
                    <TableCell className="text-right">{totals.paid}</TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Members count in the month they were activated. {totals.legacy} records predate activation
            tracking (mostly the founding group from December 2025 and January 2026) and use their
            membership start date instead, so their payment column may look incomplete. People still
            waiting to be activated are not counted. All dates use Michigan time.
          </AlertDescription>
        </Alert>
      </div>
    </AdminLayout>
  );
}
