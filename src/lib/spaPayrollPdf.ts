import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface PayrollServiceRow {
  label: string;       // "90-min Services"
  count: number;
  hours: number;
  rate: number;
  pay: number;
}

export type TipMethod = "card" | "cash" | "clover" | "other";

export const TIP_METHOD_LABELS: Record<TipMethod, string> = {
  card: "Card",
  cash: "Cash",
  clover: "Clover",
  other: "Other",
};

/** Tips paid in cash are received in hand and excluded from the payout. */
export const isPayoutTip = (m: TipMethod) => m !== "cash";

export interface PayrollTipRow {
  customer: string;
  amount: number;
  method: TipMethod;
  date?: string;      // yyyy-MM-dd
  service?: string;
}

export interface PayrollMassageRow {
  date: string;       // yyyy-MM-dd
  time: string;       // HH:mm:ss
  customer: string;
  service: string;
  durationMinutes: number;
}

export interface PayrollPdfInput {
  therapistName: string;
  startDate: Date;
  endDate: Date;
  hourlyRate: number;
  massages: PayrollMassageRow[];
  serviceRows: PayrollServiceRow[];      // by duration bucket
  prepSessions: number;                  // count of completed sessions
  prepHours: number;                     // typically sessions * 0.25
  tips: PayrollTipRow[];
}

const fmt$ = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtTime = (t: string) => {
  const [h, m] = t.split(":");
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${m} ${ampm}`;
};

const fmtDate = (d: string) => format(new Date(`${d}T00:00:00`), "EEE M/d/yy");

export function generatePayrollPdf(input: PayrollPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Massage Therapist Pay Summary", pageWidth / 2, 60, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Therapist: ${input.therapistName}`, margin, 90);
  doc.text(
    `Pay Period: ${format(input.startDate, "EEEE, MMMM d, yyyy")} – ${format(input.endDate, "EEEE, MMMM d, yyyy")}`,
    margin,
    108
  );

  let cursorY = 135;

  // Massage list
  if (input.massages.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Massages Performed", margin, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY,
      head: [["Date", "Time", "Client", "Service", "Length"]],
      body: input.massages.map(m => [
        fmtDate(m.date),
        fmtTime(m.time),
        m.customer,
        m.service,
        `${m.durationMinutes} min`,
      ]),
      headStyles: { fillColor: [47, 117, 166], textColor: 255 },
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 9 },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 20;
  }

  // Service Hours table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Service Hours", margin, cursorY);
  cursorY += 8;

  const serviceSubtotal = input.serviceRows.reduce((s, r) => s + r.pay, 0);
  autoTable(doc, {
    startY: cursorY,
    head: [["Service Type", "# of Massages", "Hours", "Rate", "Pay"]],
    body: [
      ...input.serviceRows.map(r => [
        r.label,
        String(r.count),
        `${r.hours.toFixed(2)} hrs`,
        fmt$(r.rate),
        fmt$(r.pay),
      ]),
      [{ content: "Subtotal", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } }, { content: fmt$(serviceSubtotal), styles: { fontStyle: "bold" } }],
    ],
    headStyles: { fillColor: [47, 117, 166], textColor: 255 },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  cursorY = (doc as any).lastAutoTable.finalY + 20;

  // Prep / Turnover
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Prep / Turnover Time", margin, cursorY);
  cursorY += 8;

  const prepPay = input.prepHours * input.hourlyRate;
  autoTable(doc, {
    startY: cursorY,
    head: [["Description", "# of Sessions", "Hours", "Rate", "Pay"]],
    body: [
      [
        "15 min prep per session",
        String(input.prepSessions),
        `${input.prepHours.toFixed(2)} hrs`,
        fmt$(input.hourlyRate),
        fmt$(prepPay),
      ],
      [{ content: "Subtotal", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } }, { content: fmt$(prepPay), styles: { fontStyle: "bold" } }],
    ],
    headStyles: { fillColor: [47, 117, 166], textColor: 255 },
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  cursorY = (doc as any).lastAutoTable.finalY + 20;

  const payoutTips = input.tips.filter(t => isPayoutTip(t.method) && t.amount > 0);
  const cashTips = input.tips.filter(t => t.method === "cash" && t.amount > 0);
  const payoutSubtotal = payoutTips.reduce((s, r) => s + r.amount, 0);
  const cashSubtotal = cashTips.reduce((s, r) => s + r.amount, 0);

  const subtotalByMethod = (rows: PayrollTipRow[], m: TipMethod) =>
    rows.filter(r => r.method === m).reduce((s, r) => s + r.amount, 0);

  // Tips to be paid out
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Tips To Be Paid Out", margin, cursorY);
  cursorY += 8;

  const payoutMethodRows = (["card", "clover", "other"] as TipMethod[])
    .filter(m => payoutTips.some(t => t.method === m))
    .map(m => [
      { content: `${TIP_METHOD_LABELS[m]} tips subtotal`, colSpan: 2, styles: { fontStyle: "bold" as const, halign: "right" as const } },
      { content: fmt$(subtotalByMethod(payoutTips, m)), styles: { fontStyle: "bold" as const, halign: "right" as const } },
    ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["Customer", "Paid By", "Tip"]],
    body: [
      ...payoutTips.map(t => [t.customer, TIP_METHOD_LABELS[t.method], fmt$(t.amount)]),
      ...payoutMethodRows,
      [
        { content: "Total tips owed", colSpan: 2, styles: { fontStyle: "bold" as const, halign: "right" as const, fillColor: [214, 234, 248] as [number, number, number] } },
        { content: fmt$(payoutSubtotal), styles: { fontStyle: "bold" as const, halign: "right" as const, fillColor: [214, 234, 248] as [number, number, number] } },
      ],
    ],
    headStyles: { fillColor: [47, 117, 166], textColor: 255 },
    margin: { left: margin, right: margin },
    theme: "grid",
    columnStyles: { 2: { halign: "right" } },
  });
  cursorY = (doc as any).lastAutoTable.finalY + 20;

  // Cash Tips
  if (cashTips.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Cash Tips (Already Received — Not Included in Payout)", margin, cursorY);
    cursorY += 8;

    autoTable(doc, {
      startY: cursorY,
      head: [["Customer", "Paid By", "Amount"]],
      body: [
        ...cashTips.map(t => [t.customer, "Cash", fmt$(t.amount)]),
        [
          { content: "Cash tips total (already received)", colSpan: 2, styles: { fontStyle: "bold" as const, halign: "right" as const } },
          { content: fmt$(cashSubtotal), styles: { fontStyle: "bold" as const, halign: "right" as const } },
        ],
      ],
      headStyles: { fillColor: [140, 140, 140], textColor: 255 },
      margin: { left: margin, right: margin },
      theme: "grid",
      columnStyles: { 2: { halign: "right" } },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 20;
  }

  // Total Pay Summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total Pay Summary", margin, cursorY);
  cursorY += 8;

  const totalServiceHours = input.serviceRows.reduce((s, r) => s + r.hours, 0);
  const total = serviceSubtotal + prepPay + payoutSubtotal;

  autoTable(doc, {
    startY: cursorY,
    head: [["Category", "Hours", "Amount"]],
    body: [
      [`Service Hours (${totalServiceHours.toFixed(2)} hrs @ ${fmt$(input.hourlyRate)}/hr)`, `${totalServiceHours.toFixed(2)} hrs`, fmt$(serviceSubtotal)],
      [`Prep/Turnover Time (${input.prepHours.toFixed(2)} hrs @ ${fmt$(input.hourlyRate)}/hr)`, `${input.prepHours.toFixed(2)} hrs`, fmt$(prepPay)],
      ["Tips to be paid out (card/clover/other)", "—", fmt$(payoutSubtotal)],
      [
        { content: "TOTAL TO PAY", styles: { fontStyle: "bold", fillColor: [214, 234, 248] } },
        { content: `${(totalServiceHours + input.prepHours).toFixed(2)} hrs`, styles: { fontStyle: "bold", fillColor: [214, 234, 248], halign: "center" } },
        { content: fmt$(total), styles: { fontStyle: "bold", fillColor: [214, 234, 248], halign: "right" } },
      ],
    ],
    headStyles: { fillColor: [47, 117, 166], textColor: 255 },
    margin: { left: margin, right: margin },
    theme: "grid",
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
  });
  cursorY = (doc as any).lastAutoTable.finalY + 14;

  if (cashTips.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const names = cashTips.map(t => `${t.customer} ${fmt$(t.amount)}`).join(" + ");
    doc.text(
      `*Cash tips of ${fmt$(cashSubtotal)} (${names}) were received directly and are not included in the total above.`,
      margin,
      cursorY,
      { maxWidth: pageWidth - margin * 2 }
    );
  }

  return doc;
}

export function downloadPayrollPdf(input: PayrollPdfInput) {
  const doc = generatePayrollPdf(input);
  const safeName = input.therapistName.replace(/\s+/g, "_");
  const startStr = format(input.startDate, "M-d-yy");
  const endStr = format(input.endDate, "M-d-yy");
  doc.save(`pay_summary-${safeName}_${startStr}_TO_${endStr}.pdf`);
}
