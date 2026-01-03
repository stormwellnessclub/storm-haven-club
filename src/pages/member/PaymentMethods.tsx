import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

const getCardBrandIcon = (brand: string) => {
  // Return appropriate styling based on card brand
  const brandColors: Record<string, string> = {
    visa: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    mastercard: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    amex: "bg-green-500/10 text-green-600 border-green-500/30",
    discover: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    default: "bg-secondary text-foreground border-border",
  };
  return brandColors[brand.toLowerCase()] || brandColors.default;
};

export default function MemberPaymentMethods() {
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading, refetch } = useQuery({
    queryKey: ["member-payment-methods", membership?.id],
    queryFn: async () => {
      if (!membership?.id) return { paymentMethods: [], hasPaymentMethod: false };
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "list_payment_methods",
          memberId: membership.id,
        },
      });

      if (error) throw error;
      return data as { paymentMethods: PaymentMethod[]; hasPaymentMethod: boolean };
    },
    enabled: !!membership?.id,
  });

  const handleManagePaymentMethods = async () => {
    setIsPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "customer_portal" },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        // Refetch payment methods when user returns
        setTimeout(() => refetch(), 3000);
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open payment portal. Please try again.");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const isLoading = membershipLoading || paymentMethodsLoading;

  if (isLoading) {
    return (
      <MemberLayout title="Payment Methods">
        <div className="space-y-6 max-w-3xl">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MemberLayout>
    );
  }

  if (!membership) {
    return (
      <MemberLayout title="Payment Methods">
        <Card className="max-w-2xl">
          <CardContent className="py-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-semibold mb-2">No Active Membership</h2>
            <p className="text-muted-foreground">
              Payment methods are available for active members only.
            </p>
          </CardContent>
        </Card>
      </MemberLayout>
    );
  }

  const paymentMethods = paymentMethodsData?.paymentMethods || [];

  return (
    <MemberLayout title="Payment Methods">
      <div className="space-y-6 max-w-3xl">
        {/* Payment Methods Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent" />
                <CardTitle>Saved Payment Methods</CardTitle>
              </div>
              <Button 
                onClick={handleManagePaymentMethods} 
                disabled={isPortalLoading}
                variant="outline"
                size="sm"
              >
                {isPortalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add / Manage
                  </>
                )}
              </Button>
            </div>
            <CardDescription>
              View and manage your saved payment methods for membership billing and purchases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethods.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Payment Methods</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have any saved payment methods yet.
                </p>
                <Button onClick={handleManagePaymentMethods} disabled={isPortalLoading}>
                  {isPortalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method, index) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center border ${getCardBrandIcon(method.brand)}`}>
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{method.brand}</p>
                          <span className="text-muted-foreground">•••• {method.last4}</span>
                          {index === 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-secondary/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Managing Payment Methods</p>
                <p>
                  Click "Add / Manage" to open the secure Stripe Customer Portal where you can 
                  add new cards, remove existing ones, or set a different default payment method.
                  Your saved cards are used for membership billing and any purchases you make.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MemberLayout>
  );
}
