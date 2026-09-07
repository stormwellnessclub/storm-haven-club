import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstructorPay, money, periodLabel, PayPeriod } from "@/hooks/useInstructorPay";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, Plus, Undo2 } from "lucide-react";

interface InstructorRow {
  id: string;
  first_name: string;
  last_name: string;
  default_per_class_rate: number | null;
  is_active: boolean;
}

const statusBadge = (status: PayPeriod["status"]) =>
  status === "paid" ? (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>
  ) : status === "due" ? (
    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Due</Badge>
  ) : (
    <Badge variant="secondary">Open</Badge>
  );

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function AdminInstructorPay() {
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newRate, setNewRate] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, invalidate, refreshPeriod } = useInstructorPay(selectedId);

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase
        .from("instructors")
        .select("id, first_name, last_name, default_per_class_rate, is_active")
        .order("first_name");
      if (error) {
        toast.error("Could not load instructors");
        return;
      }
      const list = (rows ?? []) as InstructorRow[];
      setInstructors(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    })();
  }, []);

  const selected = useMemo(
    () => instructors.find((i) => i.id === selectedId) ?? null,
    [instructors, selectedId],
  );
  const periods = data?.periods ?? [];
  const itemsByPeriod = data?.itemsByPeriod ?? {};

  useEffect(() => {
    if (selected) setNewRate(String(Number(selected.default_per_class_rate ?? 0)));
  }, [selected]);

  const markPaid = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_mark_pay_period_paid", { _period_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Period marked paid");
    invalidate();
  };

  const unmarkPaid = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_unmark_pay_period_paid", { _period_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Period reopened as due");
    invalidate();
  };

  const addPeriod = async () => {
    if (!selectedId || !newStart || !newEnd) return toast.error("Pick a start and end date");
    setBusy(true);
    const { data: row, error } = await supabase
      .from("instructor_pay_periods")
      .insert({
        instructor_id: selectedId,
        start_date: newStart,
        end_date: newEnd,
        rate_per_class: Number(newRate) || 0,
        status: "open",
        auto_roll: true,
      })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    await supabase.rpc("refresh_instructor_pay_period", { _period_id: row.id });
    setBusy(false);
    setNewStart("");
    setNewEnd("");
    toast.success("Pay period added");
    invalidate();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Instructor Pay</h1>
        <p className="text-sm text-muted-foreground">
          Per-class pay by period. Only classes with someone checked in are paid.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="p-2 h-fit">
          {instructors.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelectedId(i.id)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                selectedId === i.id ? "bg-muted font-medium" : "hover:bg-muted/50"
              }`}
            >
              <span>
                {i.first_name} {i.last_name}
              </span>
              <span className="text-xs text-muted-foreground">
                {money(Number(i.default_per_class_rate ?? 0))}
              </span>
            </button>
          ))}
        </Card>

        <div className="space-y-4 min-w-0">
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-4 items-end">
              <div>
                <Label className="text-xs">Start</Label>
                <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">End</Label>
                <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Rate per class</Label>
                <Input value={newRate} onChange={(e) => setNewRate(e.target.value)} />
              </div>
              <Button onClick={addPeriod} disabled={busy || !selectedId}>
                <Plus className="mr-2 h-4 w-4" />
                Add period
              </Button>
            </div>
          </Card>

          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {periods.map((p) => {
            const items = itemsByPeriod[p.id] ?? [];
            const paidClasses = items.filter((i) => i.is_paid_class);
            return (
              <Card key={p.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{periodLabel(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      {paidClasses.length} paid of {items.length} scheduled ·{" "}
                      {money(Number(p.rate_per_class))}/class
                      {p.paid_at ? ` · paid ${new Date(p.paid_at).toLocaleDateString("en-US")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(p.status)}
                    <span className="text-lg font-semibold">{money(Number(p.total_amount))}</span>
                    {p.status !== "paid" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => refreshPeriod(p.id)}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Refresh
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => markPaid(p.id)}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                          Mark paid
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => unmarkPaid(p.id)}
                      >
                        <Undo2 className="mr-2 h-3.5 w-3.5" />
                        Undo paid
                      </Button>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                          <th className="py-1 pr-3">Date</th>
                          <th className="py-1 pr-3">Class</th>
                          <th className="py-1 pr-3 text-center">Attended</th>
                          <th className="py-1 text-right">Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr
                            key={i.id}
                            className={`border-t ${i.is_paid_class ? "" : "text-muted-foreground"}`}
                          >
                            <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(i.item_date)}</td>
                            <td className="py-1.5 pr-3">{i.description}</td>
                            <td className="py-1.5 pr-3 text-center">{i.attendance_count}</td>
                            <td className="py-1.5 text-right">{money(Number(i.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
