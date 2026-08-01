import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Plus, FileDown, Download } from "lucide-react";
import { downloadCsv } from "@/lib/ptExport";
import { useSpaTherapists } from "@/hooks/useSpaManagement";
import {
  downloadPayrollPdf,
  isPayoutTip,
  TIP_METHOD_LABELS,
  type PayrollTipRow,
  type PayrollServiceRow,
  type PayrollMassageRow,
  type TipMethod,
} from "@/lib/spaPayrollPdf";
import { toast } from "sonner";

interface PayrollAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  duration_minutes: number;
  status: string;
  tip_amount: number | null;
  tip_payment_method: string | null;
  payment_method: string | null;
  amount_paid: number | null;
  customer_name: string;
}

interface PayrollData {
  therapist_id: string;
  therapist_name: string;
  hourly_rate: number;
  start_date: string;
  end_date: string;
  appointments: PayrollAppointment[];
}

const TIP_METHODS: TipMethod[] = ["card", "cash", "clover", "other"];

const inferMethod = (a: PayrollAppointment): TipMethod => {
  const m = (a.tip_payment_method || "").toLowerCase();
  if (TIP_METHODS.includes(m as TipMethod)) return m as TipMethod;
  const pm = (a.payment_method || "").toLowerCase();
  if (pm === "cash") return "cash";
  if (pm.includes("clover")) return "clover";
  if (pm === "card" || pm === "stripe") return "card";
  return "other";
};

const fmtTime = (t: string) => {
  const [h, m] = t.split(":");
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m} ${ampm}`;
};

/** Bi-weekly pay cycle anchored to Mon Jul 13 2026 (period = 14 days). */
const PAY_CYCLE_ANCHOR = new Date(2026, 6, 13);
const payPeriod = (offset: number) => {
  const days = Math.floor(
    (startOfDay(new Date()).getTime() - PAY_CYCLE_ANCHOR.getTime()) / 86400000
  );
  const idx = Math.floor(days / 14) + offset;
  const start = addDays(PAY_CYCLE_ANCHOR, idx * 14);
  return { start, end: addDays(start, 13) };
};

export function SpaPayrollTab() {
  const { data: therapists, isLoading: therapistsLoading } = useSpaTherapists();
  const [therapistId, setTherapistId] = useState<string>("");
  const [startDate, setStartDate] = useState(format(payPeriod(0).start, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(payPeriod(0).end, "yyyy-MM-dd"));

  const { data: payroll, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["therapist-payroll", therapistId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_therapist_payroll", {
        _therapist_id: therapistId,
        _start_date: startDate,
        _end_date: endDate,
      });
      if (error) throw error;
      return data as unknown as PayrollData;
    },
    enabled: !!therapistId,
  });

  // Editable state
  const [massages, setMassages] = useState<PayrollMassageRow[]>([]);
  const [serviceRows, setServiceRows] = useState<PayrollServiceRow[]>([]);
  const [tips, setTips] = useState<PayrollTipRow[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number>(26);
  const [prepSessions, setPrepSessions] = useState<number>(0);
  const [prepHours, setPrepHours] = useState<number>(0);

  // Initialize state from payroll data
  useEffect(() => {
    if (!payroll) return;
    setHourlyRate(Number(payroll.hourly_rate) || 26);
    const appts = payroll.appointments || [];

    setMassages(appts.map(a => ({
      date: a.appointment_date,
      time: a.appointment_time,
      customer: a.customer_name,
      service: a.service_name,
      durationMinutes: a.duration_minutes,
    })));

    // Group by duration bucket
    const buckets = new Map<number, PayrollAppointment[]>();
    appts.forEach(a => {
      const arr = buckets.get(a.duration_minutes) || [];
      arr.push(a);
      buckets.set(a.duration_minutes, arr);
    });

    const rate = Number(payroll.hourly_rate) || 26;
    const rows: PayrollServiceRow[] = Array.from(buckets.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([dur, items]) => {
        const hours = (items.length * dur) / 60;
        return {
          label: `${dur}-min Services`,
          count: items.length,
          hours,
          rate,
          pay: hours * rate,
        };
      });
    setServiceRows(rows);

    setPrepSessions(appts.length);
    setPrepHours(appts.length * 0.25);

    setTips(
      appts
        .filter(a => Number(a.tip_amount) > 0)
        .map(a => ({
          customer: a.customer_name,
          amount: Number(a.tip_amount) || 0,
          method: inferMethod(a),
          date: a.appointment_date,
          service: a.service_name,
        }))
    );
  }, [payroll]);

  const totals = useMemo(() => {
    const serviceTotal = serviceRows.reduce((s, r) => s + r.pay, 0);
    const prepPay = prepHours * hourlyRate;
    const payoutTips = tips.filter(t => isPayoutTip(t.method));
    const cashTips = tips.filter(t => t.method === "cash");
    const payoutTotal = payoutTips.reduce((s, t) => s + t.amount, 0);
    const cashTotal = cashTips.reduce((s, t) => s + t.amount, 0);
    const byMethod = TIP_METHODS.map(m => ({
      method: m,
      total: tips.filter(t => t.method === m).reduce((s, t) => s + t.amount, 0),
    })).filter(x => x.total > 0);
    const totalHours = serviceRows.reduce((s, r) => s + r.hours, 0) + prepHours;
    return {
      serviceTotal,
      prepPay,
      payoutTotal,
      cashTotal,
      byMethod,
      total: serviceTotal + prepPay + payoutTotal,
      totalHours,
    };
  }, [serviceRows, prepHours, hourlyRate, tips]);

  const setQuickRange = (days: number) => {
    const end = startOfDay(new Date());
    setStartDate(format(addDays(end, -days), "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const [periodOffset, setPeriodOffset] = useState(0);
  const applyPeriod = (offset: number) => {
    const { start, end } = payPeriod(offset);
    setPeriodOffset(offset);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };


  const updateTip = (idx: number, patch: Partial<PayrollTipRow>) =>
    setTips(rows => rows.map((x, j) => (j === idx ? { ...x, ...patch } : x)));

  const handleDownload = () => {
    if (!payroll || !therapists) return;
    const t = therapists.find(x => x.id === therapistId);
    if (!t) return;

    // Recompute service rows with current rate
    const recalcRows = serviceRows.map(r => ({ ...r, rate: hourlyRate, pay: r.hours * hourlyRate }));

    downloadPayrollPdf({
      therapistName: t.full_name,
      startDate: new Date(startDate + "T00:00:00"),
      endDate: new Date(endDate + "T00:00:00"),
      hourlyRate,
      massages,
      serviceRows: recalcRows,
      prepSessions,
      prepHours,
      tips,
    });
    toast.success("Pay summary downloaded");
  };

  const therapistName = therapists?.find(x => x.id === therapistId)?.full_name ?? "";
  const canDownload = !!payroll && !!therapistName;

  const handleDownloadCsv = () => {
    if (!canDownload) return;
    const rows: Record<string, unknown>[] = [];
    massages.forEach(m => {
      const tip = tips.find(t => t.date === m.date && t.customer === m.customer);
      rows.push({
        Section: "Massage",
        Date: m.date,
        Time: m.time,
        Client: m.customer,
        Service: m.service,
        Minutes: m.durationMinutes,
        Hours: (m.durationMinutes / 60).toFixed(2),
        Amount: "",
        TipAmount: tip ? tip.amount.toFixed(2) : "",
        TipPaidBy: tip ? TIP_METHOD_LABELS[tip.method] : "",
      });
    });
    serviceRows.forEach(r => {
      rows.push({
        Section: "Service Hours",
        Date: "", Time: "", Client: "",
        Service: r.label,
        Minutes: "",
        Hours: r.hours.toFixed(2),
        Amount: (r.hours * hourlyRate).toFixed(2),
        TipAmount: "", TipPaidBy: "",
      });
    });
    rows.push({
      Section: "Prep / Turnover", Date: "", Time: "", Client: "",
      Service: `${prepSessions} sessions`, Minutes: "",
      Hours: prepHours.toFixed(2), Amount: totals.prepPay.toFixed(2),
      TipAmount: "", TipPaidBy: "",
    });
    tips.forEach(t => {
      rows.push({
        Section: "Tip", Date: t.date ?? "", Time: "", Client: t.customer,
        Service: t.service ?? "", Minutes: "", Hours: "", Amount: "",
        TipAmount: t.amount.toFixed(2), TipPaidBy: TIP_METHOD_LABELS[t.method],
      });
    });
    totals.byMethod.forEach(x => {
      rows.push({
        Section: "Tip Subtotal", Date: "", Time: "", Client: "",
        Service: TIP_METHOD_LABELS[x.method], Minutes: "", Hours: "", Amount: "",
        TipAmount: x.total.toFixed(2), TipPaidBy: TIP_METHOD_LABELS[x.method],
      });
    });
    rows.push({
      Section: "TOTAL TO PAY", Date: startDate, Time: "", Client: therapistName,
      Service: `Rate $${hourlyRate.toFixed(2)}/hr`, Minutes: "",
      Hours: totals.totalHours.toFixed(2), Amount: totals.total.toFixed(2),
      TipAmount: totals.payoutTotal.toFixed(2), TipPaidBy: "Owed",
    });

    downloadCsv(
      `payroll-${therapistName.replace(/\s+/g, "_")}_${startDate}_to_${endDate}.csv`,
      rows,
      ["Section", "Date", "Time", "Client", "Service", "Minutes", "Hours", "Amount", "TipAmount", "TipPaidBy"]
    );
    toast.success("CSV downloaded");
  };



  const updateServiceRow = (idx: number, patch: Partial<PayrollServiceRow>) => {
    setServiceRows(rows => rows.map((r, i) => {
      if (i !== idx) return r;
      const merged = { ...r, ...patch };
      merged.pay = merged.hours * merged.rate;
      return merged;
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Pay Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Therapist</Label>
              <Select value={therapistId} onValueChange={setTherapistId}>
                <SelectTrigger><SelectValue placeholder="Select therapist" /></SelectTrigger>
                <SelectContent>
                  {therapists?.filter(t => t.is_active).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Hourly Rate</Label>
              <Input type="number" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPeriod(periodOffset - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={periodOffset === 0 ? "default" : "outline"} onClick={() => applyPeriod(0)}>This pay period</Button>
            <Button size="sm" variant={periodOffset === -1 ? "default" : "outline"} onClick={() => applyPeriod(-1)}>Previous pay period</Button>
            <Button size="sm" variant="outline" onClick={() => applyPeriod(periodOffset + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setQuickRange(13)}>Last 14 days</Button>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={!therapistId}>Refresh from DB</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={handleDownload} disabled={!canDownload}>
                <FileDown className="h-4 w-4 mr-1" />Download PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadCsv} disabled={!canDownload}>
                <Download className="h-4 w-4 mr-1" />Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="py-6 text-destructive text-sm">
            Could not load payroll: {(error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {therapistsLoading || isLoading || isFetching ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !therapistId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a therapist to begin.</CardContent></Card>
      ) : !payroll ? null : (
        <>
          <Card>
            <CardHeader><CardTitle>Massages Performed</CardTitle></CardHeader>
            <CardContent>
              {massages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completed massages in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Length</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {massages.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell>{format(new Date(`${m.date}T00:00:00`), "EEE M/d/yy")}</TableCell>
                        <TableCell>{fmtTime(m.time)}</TableCell>
                        <TableCell className="font-medium">{m.customer}</TableCell>
                        <TableCell>{m.service}</TableCell>
                        <TableCell>{m.durationMinutes} min</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Service Hours</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Pay</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={r.label} onChange={e => updateServiceRow(i, { label: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" className="w-20" value={r.count} onChange={e => updateServiceRow(i, { count: parseInt(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" className="w-24" value={r.hours} onChange={e => updateServiceRow(i, { hours: parseFloat(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell className="font-medium">${r.pay.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setServiceRows(rows => rows.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Subtotal</TableCell>
                    <TableCell colSpan={2} className="font-bold">${totals.serviceTotal.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setServiceRows(r => [...r, { label: "Other", count: 0, hours: 0, rate: hourlyRate, pay: 0 }])}>
                <Plus className="h-4 w-4 mr-1" />Add Row
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Prep / Turnover Time</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label># of Sessions</Label>
                <Input type="number" value={prepSessions} onChange={e => setPrepSessions(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Total Hours</Label>
                <Input type="number" step="0.01" value={prepHours} onChange={e => setPrepHours(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Pay</Label>
                <div className="h-10 flex items-center font-medium">${totals.prepPay.toFixed(2)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tips</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tips.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={t.customer} onChange={e => updateTip(i, { customer: e.target.value })} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {t.date ? format(new Date(`${t.date}T00:00:00`), "M/d/yy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" className="w-28" value={t.amount} onChange={e => updateTip(i, { amount: parseFloat(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell>
                        <Select value={t.method} onValueChange={(v) => updateTip(i, { method: v as TipMethod })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIP_METHODS.map(m => (
                              <SelectItem key={m} value={m}>{TIP_METHOD_LABELS[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setTips(rows => rows.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {totals.byMethod.map(x => (
                    <TableRow key={x.method}>
                      <TableCell colSpan={2} className="text-right font-medium">{TIP_METHOD_LABELS[x.method]} tips subtotal</TableCell>
                      <TableCell colSpan={3} className="font-medium">${x.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-bold">Tips owed in payout</TableCell>
                    <TableCell colSpan={3} className="font-bold">${totals.payoutTotal.toFixed(2)}</TableCell>
                  </TableRow>
                  {totals.cashTotal > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-muted-foreground">Cash tips already received</TableCell>
                      <TableCell colSpan={3} className="text-muted-foreground">${totals.cashTotal.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setTips(r => [...r, { customer: "", amount: 0, method: "card" }])}>
                <Plus className="h-4 w-4 mr-1" />Add Tip
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total Pay Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between"><span>Service Hours ({(totals.totalHours - prepHours).toFixed(2)} hrs)</span><span>${totals.serviceTotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Prep/Turnover ({prepHours.toFixed(2)} hrs)</span><span>${totals.prepPay.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tips to be paid out</span><span>${totals.payoutTotal.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-2 text-lg font-bold bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded">
                  <span>TOTAL TO PAY ({totals.totalHours.toFixed(2)} hrs)</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
                {totals.cashTotal > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cash tips of ${totals.cashTotal.toFixed(2)} were received directly and are not included above.
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" size="lg" onClick={handleDownload}>
                  <FileDown className="h-4 w-4 mr-2" />Download PDF
                </Button>
                <Button className="flex-1" size="lg" variant="outline" onClick={handleDownloadCsv}>
                  <Download className="h-4 w-4 mr-2" />Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
