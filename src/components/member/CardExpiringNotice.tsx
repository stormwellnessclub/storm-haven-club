import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserMembership } from "@/hooks/useUserMembership";

/**
 * Notice shown when the member's card on file is approaching expiration.
 * - Amber for 31–60 days out
 * - Red for ≤30 days out
 * Reads card_brand / card_last4 / card_exp_month / card_exp_year from members.
 * Card details are kept in sync by the daily check-expiring-cards job.
 */
export function CardExpiringNotice() {
  const { data: membership } = useUserMembership();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!membership || isDismissed) return null;
  const { card_brand, card_last4, card_exp_month, card_exp_year } = membership;
  if (!card_exp_month || !card_exp_year || !card_last4) return null;

  // Compute days until end of expiration month
  const expiry = new Date(card_exp_year, card_exp_month, 0, 23, 59, 59);
  const now = new Date();
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);

  // Show within 60 days of expiry, including expired (negative days)
  if (daysUntil > 60) return null;

  const isUrgent = daysUntil <= 30;
  const isExpired = daysUntil < 0;

  const wrapper = isUrgent
    ? "bg-destructive/10 border-b border-destructive/30"
    : "bg-amber-500/10 border-b border-amber-500/30";
  const iconColor = isUrgent
    ? "text-destructive"
    : "text-amber-600 dark:text-amber-500";
  const textColor = isUrgent
    ? "text-destructive"
    : "text-amber-900 dark:text-amber-100";
  const buttonClass = isUrgent
    ? "border-destructive text-destructive hover:bg-destructive/20"
    : "border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950";

  const expLabel = `${String(card_exp_month).padStart(2, "0")}/${String(card_exp_year).slice(-2)}`;
  const brand = card_brand || "Card";

  const message = isExpired
    ? `Your ${brand} ending ${card_last4} has expired (${expLabel}). Update now to avoid interrupted billing.`
    : `Your ${brand} ending ${card_last4} expires ${expLabel}${isUrgent ? ` (in ${daysUntil} day${daysUntil === 1 ? "" : "s"})` : ""}. Update to avoid interruption.`;

  return (
    <div className={`${wrapper} px-4 py-3`}>
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertTriangle className={`h-5 w-5 ${iconColor} shrink-0 mt-0.5`} />
          <p className={`text-sm font-medium ${textColor}`}>{message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline" className={buttonClass}>
            <Link to="/member/payment-methods">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Update Card
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDismissed(true)}
            className={textColor}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
