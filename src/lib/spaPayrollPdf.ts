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

export interface PayrollTipRow {
  customer: string;
  amount: number;
}

export interface PayrollPdfInput {
  therapistName: string;
  startDate: Date;
  endDate: Date;
  hourlyRate: number;
  serviceRows: PayrollServiceRow[];      // by duration bucket
  prepSessions: number;                  // count of completed sessions
  prepHours: number;                     // typically sessions * 0.25
  ccTips: PayrollTipRow[];
  cashTips: PayrollTipRow[];
}

const fmt$ = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  // CC Tips
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Credit Card Tips (To Be Paid Out)", margin, cursorY);
  cursorY += 8;

  const ccSubtotal = input.ccTips.reduce((s, r) => s + r.amount, 0);
  autoTable(doc, {
    startY: cursorY,
    head: [["Customer", "CC Tip"]],
    body: [
      ...input.ccTips.map(t => [t.customer, fmt$(t.amount)]),
      [{ content: "CC Tips Subtotal", styles: { fontStyle: "bold" } }, { content: fmt$(ccSubtotal), styles: { fontStyle: "bold" } }],
    ],
    headStyles: { fillColor: [47, 117, 166], textColor: 255 },
    margin: { left: margin, right: margin },
    theme: "grid",
    columnStyles: { 1: { halign: "right" } },
  });
  cursorY = (doc as any).lastAutoTable.finalY + 20;

  // Cash Tips
  if (input.cashTips.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Cash Tips (Already Received — Not Included in Payout)", margin, cursorY);
    cursorY += 8;

    const cashSubtotal = input.cashTips.reduce((s, r) => s + r.amount, 0);
    autoTable(doc, {
      startY: cursorY,
      head: [["Customer", "Amount", "Type"]],
      body: [
        ...input.cashTips.map(t => [t.customer, fmt$(t.amount), "Cash"]),
        [{ content: "Cash Tips Total (Already Received)", styles: { fontStyle: "bold" } }, { content: fmt$(cashSubtotal), styles: { fontStyle: "bold" } }, ""],
      ],
      headStyles: { fillColor: [140, 140, 140], textColor: 255 },
      margin: { left: margin, right: margin },
      theme: "grid",
      columnStyles: { 1: { halign: "right" } },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 20;
  }

  // Total Pay Summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total Pay Summary", margin, cursorY);
  cursorY += 8;

  const totalServiceHours = input.serviceRows.reduce((s, r) => s + r.hours, 0);
  const total = serviceSubtotal + prepPay + ccSubtotal;

  autoTable(doc, {
    startY: cursorY,
    head: [["Category", "Hours", "Amount"]],
    body: [
      [`Service Hours (${totalServiceHours.toFixed(2)} hrs @ ${fmt$(input.hourlyRate)}/hr)`, `${totalServiceHours.toFixed(2)} hrs`, fmt$(serviceSubtotal)],
      [`Prep/Turnover Time (${input.prepHours.toFixed(2)} hrs @ ${fmt$(input.hourlyRate)}/hr)`, `${input.prepHours.toFixed(2)} hrs`, fmt$(prepPay)],
      ["Credit Card Tips", "—", fmt$(ccSubtotal)],
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

  if (input.cashTips.length > 0) {
    const cashSubtotal = input.cashTips.reduce((s, r) => s + r.amount, 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const names = input.cashTips.map(t => `${t.customer} ${fmt$(t.amount).replace("$", "$")}`).join(" + ");
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
