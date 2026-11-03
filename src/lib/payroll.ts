// Payroll period math. Sources come from admin_payroll_sources; pay settings
// from payroll_pay_settings. Overtime = hours over 40 in a Mon–Sun Detroit week.

export type PayrollSource = { person_key: string; person_name: string; source: "shift" | "spa" | "pt" | "class"; detail: any };
export type PaySettings = { person_key: string; per_pt_session?: number | null; spa_commission_pct?: number | null; gusto_employee_id?: string | null };

export type PayrollLine = {
  person_key: string;
  name: string;
  departments: string[];
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number | null;
  openShifts: number;
  spaServices: number;
  spaServiceTotal: number;
  spaCommission: number;
  tips: number;
  ptSessions: number;
  ptPay: number;
  classPay: number;
  grossPay: number;
  gustoEmployeeId: string | null;
  missingRate: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monday (YYYY-MM-DD) of the Detroit week containing this instant. */
export function detroitWeekKey(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit" }));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftHours(s: { clock_in_at: string; clock_out_at: string | null }): number {
  if (!s.clock_out_at) return 0;
  return Math.max(0, (new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime()) / 3_600_000);
}

export function splitOvertime(shifts: { clock_in_at: string; clock_out_at: string | null }[]) {
  const byWeek = new Map<string, number>();
  for (const s of shifts) byWeek.set(detroitWeekKey(s.clock_in_at), (byWeek.get(detroitWeekKey(s.clock_in_at)) ?? 0) + shiftHours(s));
  let regular = 0, overtime = 0;
  for (const h of byWeek.values()) { regular += Math.min(40, h); overtime += Math.max(0, h - 40); }
  return { regular: round2(regular), overtime: round2(overtime) };
}

export function buildPayroll(sources: PayrollSource[], settings: PaySettings[]): PayrollLine[] {
  const set = new Map(settings.map((s) => [s.person_key, s]));
  const groups = new Map<string, PayrollSource[]>();
  for (const s of sources) groups.set(s.person_key, [...(groups.get(s.person_key) ?? []), s]);
  const lines: PayrollLine[] = [];
  for (const [key, rows] of groups) {
    const cfg = set.get(key);
    const shifts = rows.filter((r) => r.source === "shift").map((r) => r.detail);
    const spa = rows.filter((r) => r.source === "spa").map((r) => r.detail);
    const pt = rows.filter((r) => r.source === "pt");
    const cls = rows.filter((r) => r.source === "class").map((r) => r.detail);
    const { regular, overtime } = splitOvertime(shifts);
    const rateRaw = shifts.find((s) => s.hourly_rate != null)?.hourly_rate;
    const hourlyRate = rateRaw == null ? null : Number(rateRaw);
    const spaServiceTotal = round2(spa.reduce((a, s) => a + Number(s.price || 0), 0));
    const spaCommission = round2(spaServiceTotal * (Number(cfg?.spa_commission_pct ?? 0) / 100));
    const tips = round2(spa.reduce((a, s) => a + Number(s.tip || 0), 0));
    const ptPay = round2(pt.length * Number(cfg?.per_pt_session ?? 0));
    const classPay = round2(cls.reduce((a, c) => a + Number(c.amount || 0), 0));
    const hourlyPay = hourlyRate == null ? 0 : regular * hourlyRate + overtime * hourlyRate * 1.5;
    const missingRate =
      (shifts.length > 0 && hourlyRate == null) ||
      (spa.length > 0 && cfg?.spa_commission_pct == null) ||
      (pt.length > 0 && cfg?.per_pt_session == null);
    lines.push({
      person_key: key,
      name: rows[0].person_name,
      departments: [...new Set(shifts.map((s) => s.department))],
      regularHours: regular,
      overtimeHours: overtime,
      hourlyRate,
      openShifts: shifts.filter((s) => !s.clock_out_at || s.auto_closed).length,
      spaServices: spa.length,
      spaServiceTotal,
      spaCommission,
      tips,
      ptSessions: pt.length,
      ptPay,
      classPay,
      // Tips are reported separately (Gusto "paycheck tips"), not inside gross wages.
      grossPay: round2(hourlyPay + spaCommission + ptPay + classPay),
      gustoEmployeeId: cfg?.gusto_employee_id ?? null,
      missingRate,
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name));
}

export function payrollCsv(lines: PayrollLine[]): string {
  const head = ["Name", "Gusto employee ID", "Regular hours", "Overtime hours", "Hourly rate", "Spa commission", "Tips", "PT sessions", "PT pay", "Class pay", "Gross pay"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head, ...lines.map((l) => [l.name, l.gustoEmployeeId, l.regularHours, l.overtimeHours, l.hourlyRate, l.spaCommission, l.tips, l.ptSessions, l.ptPay, l.classPay, l.grossPay])]
    .map((r) => r.map(esc).join(","))
    .join("\n");
}
