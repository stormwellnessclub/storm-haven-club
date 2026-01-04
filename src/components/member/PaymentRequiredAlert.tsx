import { AlertTriangle, CreditCard, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserMembership } from "@/hooks/useUserMembership";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { format, addYears } from "date-fns";
import { getAnnualFeeAmount, normalizeGender, Gender } from "@/lib/stripeProducts";

export function PaymentRequiredAlert() {
  const { data: membership } = useUserMembership();
  const { isAnnualFeeOverdue, isDuesPastDue, annualFeeExpiresAt } = usePaymentStatus();
  const [isLoadingAnnualFee, setIsLoadingAnnualFee] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  if (!membership) return null;

  const gender = normalizeGender(membership.gender) as Gender;
  const annualFeeAmount = getAnnualFeeAmount(gender);

  const handlePayAnnualFee = async () => {
    setIsLoadingAnnualFee(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "pay_annual_fee",
          memberId: membership.id,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error creating annual fee checkout:", err);
      toast.error("Failed to start payment. Please try again.");
    } finally {
      setIsLoadingAnnualFee(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "customer_portal",
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      toast.error("Failed to open billing portal. Please try again.");
    } finally {
      setIsLoadingPortal(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full border-destructive">
        <CardHeader className="bg-destructive/10 border-b border-destructive/20">
          <CardTitle className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            Payment Required
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <p className="text-muted-foreground">
            Your membership is currently on hold due to outstanding payments.
            Please resolve the following to restore full access:
          </p>

          <div className="space-y-4">
            {isAnnualFeeOverdue && (
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold">Annual Membership Fee</p>
                    <p className="text-sm text-muted-foreground">
                      {annualFeeExpiresAt
                        ? `Expired on ${format(annualFeeExpiresAt, "MMMM d, yyyy")}`
                        : "Payment required to continue membership"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">${annualFeeAmount}</span>
                  <Button
                    onClick={handlePayAnnualFee}
                    disabled={isLoadingAnnualFee}
                    size="sm"
                  >
                    {isLoadingAnnualFee ? "Loading..." : "Pay Now"}
                  </Button>
                </div>
              </div>
            )}

            {isDuesPastDue && (
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold">Monthly Dues Past Due</p>
                    <p className="text-sm text-muted-foreground">
                      Your last payment failed. Please update your payment method.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleUpdatePaymentMethod}
                    disabled={isLoadingPortal}
                    size="sm"
                    variant="outline"
                  >
                    {isLoadingPortal ? "Loading..." : "Update Payment Method"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Once payment is received, your full membership access will be restored.
              If you need assistance, please contact our front desk.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
