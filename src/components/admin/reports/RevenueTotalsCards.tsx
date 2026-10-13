import { Card, CardContent } from "@/components/ui/card";
import { money, type Totals } from "@/lib/revenueLedger";

/**
 * Headline figures for a ledger-based report. "Collected" reconciles to money
 * received; "Revenue" is what the club earned after taking out sales tax owed to
 * the state, card processing fees passed to customers and staff tips.
 */
export function RevenueTotalsCards({ totals }: { totals: Totals }) {
  const cards = [
    { label: "Revenue", value: totals.net, hint: "After tax, card fees & tips", strong: true },
    { label: "Collected", value: totals.gross, hint: "Everything customers paid, net of refunds" },
    { label: "Sales tax collected", value: totals.tax, hint: "Owed to Michigan" },
    { label: "Card fees charged", value: totals.fee, hint: "Processing fees passed to customers" },
    { label: "Tips", value: totals.tip, hint: "Paid out to staff" },
    { label: "Refunds & disputes", value: totals.refunds, hint: "Already subtracted above" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={c.strong ? "text-2xl font-bold text-primary" : "text-xl font-semibold"}>{money(c.value)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{c.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
