import { useMemo, useState } from "react";
import { InstructorShell } from "@/components/instructor/InstructorShell";
import { useInstructorContext } from "@/hooks/useInstructorContext";
import { useInstructorPay, money, periodLabel, PayPeriod } from "@/hooks/useInstructorPay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, CheckCircle2, Clock } from "lucide-react";

const statusBadge = (status: PayPeriod["status"]) => {
  if (status === "paid")
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>;
  if (status === "due")
    return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Due</Badge>;
  return <Badge variant="secondary">Open</Badge>;
};

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function InstructorPay() {
  const { instructor, loading } = useInstructorContext();
  const { data, isLoading } = useInstructorPay(instructor?.id);
  const [openId, setOpenId] = useState<string | null>(null);

  const periods = data?.periods ?? [];
  const itemsByPeriod = data?.itemsByPeriod ?? {};
  const current = useMemo(
    () => periods.find((p) => p.status === "open") ?? periods[0],
    [periods],
  );
  const unpaidTotal = periods
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + Number(p.total_amount), 0);

  const selected = openId ?? current?.id ?? null;

  return (
    <InstructorShell>
      <div className="p-6 md:p-10 max-w-5xl print:p-0">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-[#C5A059]">Hours & Pay</p>
        <h2
          style={{ fontFamily: "'Instrument Serif', serif" }}
          className="text-4xl font-light text-[#1A1A1A] mb-6"
        >
          {instructor ? `${instructor.first_name}'s pay` : "Pay"}
        </h2>

        {(loading || isLoading) && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && !isLoading && periods.length === 0 && (
          <p className="text-sm text-gray-600">
            No pay periods have been set up yet. Once admin adds your rate and period, your classes
            show up here automatically.
          </p>
        )}

        {current && (
          <div className="grid gap-4 sm:grid-cols-3 mb-8 print:hidden">
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Current period</p>
              <p className="mt-1 text-lg font-medium">{periodLabel(current)}</p>
              <div className="mt-2">{statusBadge(current.status)}</div>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Earned this period</p>
              <p className="mt-1 text-2xl font-light">{money(Number(current.total_amount))}</p>
              <p className="text-xs text-gray-500">
                {(itemsByPeriod[current.id] ?? []).filter((i) => i.is_paid_class).length} paid classes ·{" "}
                {money(Number(current.rate_per_class))}/class
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Outstanding</p>
              <p className="mt-1 text-2xl font-light">{money(unpaidTotal)}</p>
              <p className="text-xs text-gray-500">Across all unpaid periods</p>
            </Card>
          </div>
        )}

        <div className="space-y-3">
          {periods.map((p) => {
            const items = itemsByPeriod[p.id] ?? [];
            const isOpen = selected === p.id;
            const attended = items.filter((i) => i.is_paid_class);
            return (
              <Card key={p.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? "" : p.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F5F2ED]"
                >
                  <div className="flex items-center gap-3">
                    {p.status === "paid" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{periodLabel(p)}</p>
                      <p className="text-xs text-gray-500">
                        {attended.length} paid {attended.length === 1 ? "class" : "classes"} ·{" "}
                        {items.length} scheduled
                        {p.paid_at
                          ? ` · paid ${new Date(p.paid_at).toLocaleDateString("en-US")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(p.status)}
                    <span className="text-base font-medium">{money(Number(p.total_amount))}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[#E5E2DD] px-4 py-3">
                    {items.length === 0 ? (
                      <p className="py-2 text-sm text-gray-500">No classes in this period yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500">
                              <th className="py-2 pr-3">Date</th>
                              <th className="py-2 pr-3">Time</th>
                              <th className="py-2 pr-3">Class</th>
                              <th className="py-2 pr-3 text-center">Attended</th>
                              <th className="py-2 pr-3 text-right">Rate</th>
                              <th className="py-2 text-right">Pay</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((i) => (
                              <tr
                                key={i.id}
                                className={`border-t border-[#F0EDE8] ${
                                  i.is_paid_class ? "" : "text-gray-400"
                                }`}
                              >
                                <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(i.item_date)}</td>
                                <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(i.start_time)}</td>
                                <td className="py-2 pr-3">
                                  {i.description}
                                  {i.is_manual && (
                                    <span className="ml-2 text-[10px] uppercase tracking-widest text-[#C5A059]">
                                      Added
                                    </span>
                                  )}
                                  {i.notes && (
                                    <span className="block text-xs text-gray-500">{i.notes}</span>
                                  )}
                                </td>
                                <td className="py-2 pr-3 text-center">{i.attendance_count}</td>
                                <td className="py-2 pr-3 text-right">{money(Number(i.rate))}</td>
                                <td className="py-2 text-right font-medium">
                                  {money(Number(i.amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-[#E5E2DD]">
                              <td colSpan={5} className="py-2 pr-3 text-right text-sm font-medium">
                                Period total
                              </td>
                              <td className="py-2 text-right text-base font-semibold">
                                {money(Number(p.total_amount))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end print:hidden">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="mr-2 h-3.5 w-3.5" />
                        Print / save statement
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Classes with no one checked in are listed for reference but aren't paid. Cancelled classes
          are excluded.
        </p>
      </div>
    </InstructorShell>
  );
}
