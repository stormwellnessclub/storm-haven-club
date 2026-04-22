import { format } from "date-fns";
import { CalendarClock, CreditCard, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNextMemberPayment } from "@/hooks/useNextMemberPayment";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatCard(brand: string | null, last4: string | null) {
  if (!brand && !last4) return "No card on file";
  return `${brand ? brand.toUpperCase() : "Card"} xxxx${last4 ?? "????"}`;
}

export function NextPaymentCard({ memberId }: { memberId: string }) {
  const { data, isLoading } = useNextMemberPayment(memberId);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Next Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-muted-foreground">Next dues charge</p>
          <p className="font-medium">
            {data.nextDuesDate ? format(new Date(`${data.nextDuesDate}T12:00:00`), "MMM d, yyyy") : "Unknown"} — {formatMoney(data.nextDuesAmount)}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            {formatCard(data.cardBrand, data.cardLast4)}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground">Next annual fee</p>
          <p className="font-medium">
            {data.nextAnnualFeeDate ? format(new Date(`${data.nextAnnualFeeDate}T12:00:00`), "MMM d, yyyy") : "Unknown"} — {formatMoney(data.nextAnnualFeeAmount)}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            {formatCard(data.cardBrand, data.cardLast4)}
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Open failed payments: {data.openFailedCount}
          </p>
          <p className="mt-1 text-muted-foreground">Amount owed: {formatMoney(data.openFailedAmount)}</p>
        </div>
      </CardContent>
    </Card>
  );
}