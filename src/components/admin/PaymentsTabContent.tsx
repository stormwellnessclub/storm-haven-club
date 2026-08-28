import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChargeHistory } from "@/components/ChargeHistory";
import { MemberPTFinancialSummary } from "@/components/admin/MemberPTFinancialSummary";
import { AdminActionButton, ADMIN_ACTION_TOOLTIPS } from "@/components/admin/AdminActionButton";
import { useAdminMemberPaymentMethods, useRefreshAdminMemberPaymentMethods } from "@/hooks/useAdminMemberPaymentMethods";
import { 
  CreditCard, DollarSign, Plus, RefreshCw, Loader2, AlertCircle, CheckCircle2
} from "lucide-react";

interface PaymentsTabContentProps {
  member: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    card_brand?: string | null;
    card_last4?: string | null;
    card_exp_month?: number | null;
    card_exp_year?: number | null;
    stripe_customer_id?: string | null;
  };
  onAddCard: () => void;
  isCreatingSetupIntent: boolean;
  onChargeCard: () => void;
  onRefundClick: (charge: {
    id: string;
    amount: number;
    description: string;
    status: string;
    created_at: string;
    stripe_payment_intent_id: string | null;
    charge_type?: string;
  }) => void;
}

export function PaymentsTabContent({
  member,
  onAddCard,
  isCreatingSetupIntent,
  onChargeCard,
  onRefundClick,
}: PaymentsTabContentProps) {
  const { data: stripePaymentMethods, isLoading: isLoadingPaymentMethods } = useAdminMemberPaymentMethods(member.id);
  const refreshPaymentMethods = useRefreshAdminMemberPaymentMethods();
  
  const handleRefreshFromStripe = () => {
    refreshPaymentMethods.mutate(member.id);
  };

  // Use Stripe data if available, otherwise fall back to cached metadata
  const hasPaymentMethodsFromStripe = stripePaymentMethods?.hasPaymentMethod;
  const paymentMethods = stripePaymentMethods?.paymentMethods || [];
  
  // Show cached data if Stripe fetch hasn't completed yet
  const hasCachedCard = member.card_brand && member.card_last4;
  const hasAnyPaymentMethod = hasPaymentMethodsFromStripe || hasCachedCard;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                {stripePaymentMethods?.stripeCustomerId ? (
                  <span className="text-xs font-mono">
                    Customer: {stripePaymentMethods.stripeCustomerId}
                    {stripePaymentMethods.customerSource === 'stripe_lookup' && (
                      <Badge variant="outline" className="ml-2 text-xs">Found via email lookup</Badge>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No Stripe customer linked
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshFromStripe}
                disabled={refreshPaymentMethods.isPending}
              >
                {refreshPaymentMethods.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fetch from Stripe
              </Button>
              <Button onClick={onAddCard} disabled={isCreatingSetupIntent}>
                {isCreatingSetupIntent && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Plus className="h-4 w-4 mr-2" />Add Card
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPaymentMethods ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div 
                  key={pm.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-6 w-6" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{pm.brand} •••• {pm.last4}</p>
                        {pm.isDefault && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                        {pm.nickname && (
                          <Badge variant="outline" className="text-xs">{pm.nickname}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {pm.expMonth}/{pm.expYear}
                        {pm.createdAt && (
                          <span className="ml-2 text-xs">
                            • Added {format(new Date(pm.createdAt), 'MMM d, yyyy')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <AdminActionButton
                    label="Charge"
                    icon={<DollarSign className="h-4 w-4 mr-2" />}
                    variant="outline"
                    tooltip={ADMIN_ACTION_TOOLTIPS.chargeCard}
                    onClick={onChargeCard}
                  />
                </div>
              ))}
            </div>
          ) : hasCachedCard ? (
            // Fallback to cached metadata if Stripe fetch returned empty
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-accent" />
                <p className="text-sm text-accent-foreground">
                  Showing cached card data. Click "Fetch from Stripe" to get latest.
                </p>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6" />
                  <div>
                    <p className="font-medium capitalize">{member.card_brand} •••• {member.card_last4}</p>
                    {member.card_exp_month && member.card_exp_year && (
                      <p className="text-sm text-muted-foreground">
                        Expires {member.card_exp_month}/{member.card_exp_year}
                      </p>
                    )}
                  </div>
                </div>
                <AdminActionButton
                  label="Charge Card"
                  icon={<DollarSign className="h-4 w-4 mr-2" />}
                  variant="outline"
                  tooltip={ADMIN_ACTION_TOOLTIPS.chargeCard}
                  onClick={onChargeCard}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No payment method on file</p>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {stripePaymentMethods?.message || 
                  "The member may have added a card under a different email. Click 'Fetch from Stripe' to search by their email address."}
              </p>
              <Button 
                variant="outline" 
                onClick={handleRefreshFromStripe}
                disabled={refreshPaymentMethods.isPending}
              >
                {refreshPaymentMethods.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Search Stripe by Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <MemberPTFinancialSummary memberId={member.id} />

      <Card>
        <CardHeader>
          <CardTitle>Charge History</CardTitle>
        </CardHeader>
        <CardContent>
          <ChargeHistory 
            memberId={member.id} 
            isAdmin={true}
            recipientEmail={member.email}
            recipientName={`${member.first_name} ${member.last_name}`}
            onRefundClick={onRefundClick}
          />
        </CardContent>
      </Card>
    </div>
  );
}
