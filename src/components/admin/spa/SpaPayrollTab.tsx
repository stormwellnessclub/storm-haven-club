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
import { Loader2, Trash2, Plus, FileDown } from "lucide-react";
import { useSpaTherapists } from "@/hooks/useSpaManagement";
import { downloadPayrollPdf, type PayrollTipRow, type PayrollServiceRow } from "@/lib/spaPayrollPdf";
import { toast } from "sonner";

interface PayrollAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  duration_minutes: number;
  status: string;
  tip_amount: number | null;
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

export function SpaPayrollTab() {
  const { data: therapists, isLoading: therapistsLoading } = useSpaTherapists();
  const [therapistId, setTherapistId] = useState<string>("");
  const [startDate, setStartDate] = useState(format(addDays(startOfDay(new Date()), -14), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(startOfDay(new Date()), "yyyy-MM-dd"));

  const { data: payroll, isLoading, refetch, isFetching } = useQuery({
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
  const [serviceRows, setServiceRows] = useState<PayrollServiceRow[]>([]);
  const [ccTips, setCcTips] = useState<PayrollTipRow[]>([]);
  const [cashTips, setCashTips] = useState<PayrollTipRow[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number>(26);
  const [prepSessions, setPrepSessions] = useState<number>(0);
  const [prepHours, setPrepHours] = useState<number>(0);

  // Initialize state from payroll data
  useEffect(() => {
    if (!payroll) return;
    setHourlyRate(Number(payroll.hourly_rate) || 26);
    const appts = payroll.appointments || [];

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

    // CC tips: payment_method === 'card' (include zero tips so admin can edit)
    const cc = appts
      .filter(a => (a.payment_method === "card" || a.payment_method === "stripe"))
      .map(a => ({ customer: a.customer_name, amount: Number(a.tip_amount) || 0 }));
    setCcTips(cc);

    // Cash tips
    const cash = appts
      .filter(a => a.payment_method === "cash" && Number(a.tip_amount) > 0)
      .map(a => ({ customer: a.customer_name, amount: Number(a.tip_amount) || 0 }));
    setCashTips(cash);
  }, [payroll]);

  const totals = useMemo(() => {
    const serviceTotal = serviceRows.reduce((s, r) => s + r.pay, 0);
    const prepPay = prepHours * hourlyRate;
    const ccTotal = ccTips.reduce((s, t) => s + t.amount, 0);
    const cashTotal = cashTips.reduce((s, t) => s + t.amount, 0);
    const totalHours = serviceRows.reduce((s, r) => s + r.hours, 0) + prepHours;
    return { serviceTotal, prepPay, ccTotal, cashTotal, total: serviceTotal + prepPay + ccTotal, totalHours };
  }, [serviceRows, prepHours, hourlyRate, ccTips, cashTips]);

  const setQuickRange = (days: number) => {
    const end = startOfDay(new Date());
    setStartDate(format(addDays(end, -days), "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const handleDownload = () => {
    if (!payroll) return;
    if (!therapists) return;
    const t = therapists.find(x => x.id === therapistId);
    if (!t) return;

    // Recompute service rows with current rate
    const recalcRows = serviceRows.map(r => ({ ...r, rate: hourlyRate, pay: r.hours * hourlyRate }));

    downloadPayrollPdf({
      therapistName: t.full_name,
      startDate: new Date(startDate + "T00:00:00"),
      endDate: new Date(endDate + "T00:00:00"),
      hourlyRate,
      serviceRows: recalcRows,
      prepSessions,
      prepHours,
      ccTips,
      cashTips,
    });
    toast.success("Pay summary downloaded");
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setQuickRange(13)}>Last 2 weeks</Button>
            <Button size="sm" variant="outline" onClick={() => {
              setStartDate("2026-04-20"); setEndDate("2026-05-02");
            }}>April 20 – May 2</Button>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={!therapistId}>Refresh from DB</Button>
          </div>
        </CardContent>
      </Card>

      {therapistsLoading || isLoading || isFetching ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !therapistId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a therapist to begin.</CardContent></Card>
      ) : !payroll ? null : (
        <>
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
            <CardHeader><CardTitle>Credit Card Tips (To Be Paid Out)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>CC Tip</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ccTips.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={t.customer} onChange={e => setCcTips(rows => rows.map((x, j) => j === i ? { ...x, customer: e.target.value } : x))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" className="w-28" value={t.amount} onChange={e => setCcTips(rows => rows.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setCcTips(rows => rows.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="text-right font-bold">CC Tips Subtotal</TableCell>
                    <TableCell colSpan={2} className="font-bold">${totals.ccTotal.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setCcTips(r => [...r, { customer: "", amount: 0 }])}>
                <Plus className="h-4 w-4 mr-1" />Add Tip
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cash Tips (Already Received)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashTips.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={t.customer} onChange={e => setCashTips(rows => rows.map((x, j) => j === i ? { ...x, customer: e.target.value } : x))} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" className="w-28" value={t.amount} onChange={e => setCashTips(rows => rows.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setCashTips(rows => rows.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cashTips.length > 0 && (
                    <TableRow>
                      <TableCell className="text-right font-bold">Cash Tips Total</TableCell>
                      <TableCell colSpan={2} className="font-bold">${totals.cashTotal.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setCashTips(r => [...r, { customer: "", amount: 0 }])}>
                <Plus className="h-4 w-4 mr-1" />Add Cash Tip
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total Pay Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between"><span>Service Hours ({totals.totalHours - prepHours} hrs)</span><span>${totals.serviceTotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Prep/Turnover ({prepHours.toFixed(2)} hrs)</span><span>${totals.prepPay.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Credit Card Tips</span><span>${totals.ccTotal.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-2 text-lg font-bold bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded">
                  <span>TOTAL TO PAY ({totals.totalHours.toFixed(2)} hrs)</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>
              <Button className="mt-4 w-full" size="lg" onClick={handleDownload}>
                <FileDown className="h-4 w-4 mr-2" />Generate PDF
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
