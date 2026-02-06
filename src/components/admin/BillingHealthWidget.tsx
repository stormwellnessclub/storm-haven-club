import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CreditCard,
  CalendarX,
  XCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useMembersBillingIssues } from "@/hooks/useMembersBillingIssues";

export function BillingHealthWidget() {
  const { data: billingIssues, isLoading } = useMembersBillingIssues();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Billing Health
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasIssues = billingIssues && billingIssues.totalWithIssues > 0;

  const issueItems = [
    {
      icon: XCircle,
      label: "Failed Payments",
      count: billingIssues?.failedPayments || 0,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      icon: CalendarX,
      label: "Missing Subscription",
      count: billingIssues?.missingSubscription || 0,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      icon: CreditCard,
      label: "Expiring/Missing Cards",
      count: (billingIssues?.expiringCards || 0) + (billingIssues?.missingPaymentMethod || 0),
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <Card className={hasIssues ? "border-amber-200 dark:border-amber-800" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          Billing Health
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/members?filter=issues" className="text-xs">
            View All <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {hasIssues ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Members with issues
              </span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                {billingIssues.totalWithIssues}
              </Badge>
            </div>
            {issueItems
              .filter((item) => item.count > 0)
              .map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${item.bgColor}`}>
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.count}
                  </Badge>
                </div>
              ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              All members in good standing
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
