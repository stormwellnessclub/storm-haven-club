import { Badge } from "@/components/ui/badge";
import { getSpaPaymentState } from "@/lib/spaPaymentState";

export function SpaPaymentBadge({ appointment, className = "" }: { appointment: any; className?: string }) {
  const s = getSpaPaymentState(appointment);
  if (appointment?.status === "cancelled" && s.kind === "unpaid") return null;
  const tone =
    s.kind === "prepaid_online" || s.kind === "paid_card"
      ? "bg-success/10 text-success border-success/40"
      : s.kind === "paid_desk"
      ? "bg-primary/10 text-primary border-primary/40"
      : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`${tone} ${className}`}>
      {s.label}
    </Badge>
  );
}
