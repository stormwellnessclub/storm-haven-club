import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addYears, parseISO } from "date-fns";
import { getMembershipPrice, getAnnualFeeAmount, normalizeTierName, normalizeGender, type MembershipTier, type BillingType, type Gender } from "@/lib/stripeProducts";

interface BillingSummaryProps {
  membershipType: string;
  billingType: string | null;
  gender: string | null;
  annualFeePaidAt: string | null;
  isFoundingMember: boolean;
  nextBillingDate: Date | null;
}

export function BillingSummary({
  membershipType,
  billingType,
  gender,
  annualFeePaidAt,
  isFoundingMember,
  nextBillingDate,
}: BillingSummaryProps) {
  const tier = normalizeTierName(membershipType);
  const normalizedGender = normalizeGender(gender);
  const billing = (billingType?.toLowerCase() === 'annual' ? 'annual' : 'monthly') as BillingType;

  // Get pricing
  const annualFee = getAnnualFeeAmount(normalizedGender);
  const membershipPrice = getMembershipPrice(tier, billing, normalizedGender);

  // Calculate annual fee validity
  const annualFeeValidUntil = annualFeePaidAt 
    ? addYears(parseISO(annualFeePaidAt), 1)
    : null;

  const isAnnualFeePaid = !!annualFeePaidAt;

  return (
    <Card className="bg-muted/30 border-border/50">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Billing Overview
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Annual Fee Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Annual Fee</span>
              <span className="text-sm font-medium">${annualFee}/year</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge 
                variant="outline" 
                className={isAnnualFeePaid 
                  ? "bg-green-500/10 text-green-600 border-green-500/30 text-xs" 
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs"
                }
              >
                {isAnnualFeePaid ? "Paid" : "Unpaid"}
              </Badge>
            </div>
            {annualFeePaidAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Paid</span>
                <span className="text-sm">{format(parseISO(annualFeePaidAt), "MMM d, yyyy")}</span>
              </div>
            )}
            {annualFeeValidUntil && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valid until</span>
                <span className="text-sm">{format(annualFeeValidUntil, "MMM d, yyyy")}</span>
              </div>
            )}
          </div>

          {/* Membership Dues Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Membership Rate</span>
              {membershipPrice && (
                <span className="text-sm font-medium">
                  ${membershipPrice.amount}/{membershipPrice.interval === 'year' ? 'year' : 'mo'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Billing Type</span>
              <span className="text-sm">
                {isFoundingMember ? 'Annual (Founding)' : billing === 'annual' ? 'Annual' : 'Monthly'}
              </span>
            </div>
            {nextBillingDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next Payment</span>
                <span className="text-sm">{format(nextBillingDate, "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
