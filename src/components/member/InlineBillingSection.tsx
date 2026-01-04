import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Loader2, AlertCircle, Trash2, Calendar, DollarSign, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { AddCardModal } from "@/components/member/AddCardModal";
import { CancelSubscriptionDialog } from "@/components/member/CancelSubscriptionDialog";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface SubscriptionData {
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      price: {
        unit_amount: number;
        recurring?: {
          interval: string;
        };
      };
    }>;
  };
}

interface InlineBillingSectionProps {
  memberId: string;
  membershipType: string;
  stripeSubscriptionId?: string | null;
  billingType?: string | null;
}

const getCardBrandIcon = (brand: string) => {
  const brandColors: Record<string, string> = {
    visa: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    mastercard: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    amex: "bg-green-500/10 text-green-600 border-green-500/30",
    discover: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    default: "bg-secondary text-foreground border-border",
  };
  return brandColors[brand.toLowerCase()] || brandColors.default;
};

export function InlineBillingSection({ 
  memberId, 
  membershipType,
  stripeSubscriptionId,
  billingType 
}: InlineBillingSectionProps) {
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [cardToDelete, setCardToDelete] = useState<PaymentMethod | null>(null);

  // Fetch payment methods
  const { data: paymentMethodsData, isLoading: paymentMethodsLoading, refetch: refetchPaymentMethods } = useQuery({
    queryKey: ["member-payment-methods", memberId],
    queryFn: async () => {
      if (!memberId) return { paymentMethods: [], hasPaymentMethod: false };
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "list_payment_methods",
          memberId: memberId,
        },
      });

      if (error) throw error;
      return data as { paymentMethods: PaymentMethod[]; hasPaymentMethod: boolean };
    },
    enabled: !!memberId,
  });

  // Fetch subscription details
  const { data: subscriptionData, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery({
    queryKey: ["member-subscription", stripeSubscriptionId],
    queryFn: async () => {
      if (!stripeSubscriptionId) return null;
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "get_subscription",
          subscriptionId: stripeSubscriptionId,
        },
      });

      if (error) throw error;
      return data?.subscription as SubscriptionData | null;
    },
    enabled: !!stripeSubscriptionId,
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["member-invoices", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "list_invoices",
          memberId: memberId,
        },
      });

      if (error) throw error;
      return data?.invoices || [];
    },
    enabled: !!memberId,
  });

  const handleAddCardSuccess = () => {
    refetchPaymentMethods();
    // Double refetch to ensure the list is up to date
    setTimeout(() => refetchPaymentMethods(), 500);
  };

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;

    setDeletingCardId(cardToDelete.id);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "detach_payment_method",
          paymentMethodId: cardToDelete.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Card removed successfully");
      refetchPaymentMethods();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove card. Please try again.");
    } finally {
      setDeletingCardId(null);
      setCardToDelete(null);
    }
  };

  const handleCancelSuccess = () => {
    refetchSubscription();
  };

  const isLoading = paymentMethodsLoading || subscriptionLoading;
  const paymentMethods = paymentMethodsData?.paymentMethods || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Calculate subscription details
  const nextBillingDate = subscriptionData?.current_period_end 
    ? new Date(subscriptionData.current_period_end * 1000) 
    : null;
  
  const monthlyAmount = subscriptionData?.items?.data?.[0]?.price?.unit_amount 
    ? subscriptionData.items.data.reduce((sum, item) => sum + (item.price.unit_amount || 0), 0) / 100
    : null;

  const isCanceled = subscriptionData?.cancel_at_period_end;
  const subscriptionStatus = subscriptionData?.status || 'unknown';

  return (
    <div className="space-y-6">
      {/* Subscription Details Card */}
      {stripeSubscriptionId && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              <CardTitle>Subscription Details</CardTitle>
            </div>
            <CardDescription>
              Your current subscription status and billing information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={isCanceled ? "outline" : subscriptionStatus === 'active' ? "default" : "secondary"}
                    className={isCanceled ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : ""}
                  >
                    {isCanceled ? "Cancels at Period End" : subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                  </Badge>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground mb-1">Plan</p>
                <p className="font-medium">{membershipType} ({billingType === 'annual' ? 'Annual' : 'Monthly'})</p>
              </div>
              
              {nextBillingDate && (
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    {isCanceled ? "Access Until" : "Next Billing Date"}
                  </p>
                  <p className="font-medium">{format(nextBillingDate, "MMMM d, yyyy")}</p>
                </div>
              )}
              
              {monthlyAmount && !isCanceled && (
                <div className="p-4 rounded-lg bg-secondary/50">
                  <p className="text-sm text-muted-foreground mb-1">
                    {billingType === 'annual' ? 'Annual' : 'Monthly'} Amount
                  </p>
                  <p className="font-medium">${monthlyAmount.toFixed(2)}</p>
                </div>
              )}
            </div>
            
            {!isCanceled && (
              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setIsCancelDialogOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Methods Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-accent" />
              <CardTitle>Payment Methods</CardTitle>
            </div>
            <Button 
              onClick={() => setIsAddCardModalOpen(true)}
              variant="outline"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          </div>
          <CardDescription>
            Manage your saved payment methods for billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="py-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium mb-1">No Payment Methods</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add a card to manage your billing
              </p>
              <Button size="sm" onClick={() => setIsAddCardModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Card
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method, index) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${getCardBrandIcon(method.brand)}`}>
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium capitalize">{method.brand}</p>
                        <span className="text-sm text-muted-foreground">•••• {method.last4}</span>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setCardToDelete(method)}
                    disabled={deletingCardId === method.id}
                  >
                    {deletingCardId === method.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Card */}
      {invoicesData && invoicesData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              <CardTitle>Recent Invoices</CardTitle>
            </div>
            <CardDescription>
              Your recent subscription invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoicesData.slice(0, 5).map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(invoice.created * 1000), "MMMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {invoice.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      ${(invoice.amount_paid / 100).toFixed(2)}
                    </span>
                    {invoice.invoice_pdf && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        asChild
                      >
                        <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Card Modal */}
      <AddCardModal
        open={isAddCardModalOpen}
        onOpenChange={setIsAddCardModalOpen}
        onSuccess={handleAddCardSuccess}
        memberId={memberId}
      />

      {/* Cancel Subscription Dialog */}
      {stripeSubscriptionId && (
        <CancelSubscriptionDialog
          open={isCancelDialogOpen}
          onOpenChange={setIsCancelDialogOpen}
          subscriptionId={stripeSubscriptionId}
          accessEndDate={nextBillingDate}
          onSuccess={handleCancelSuccess}
        />
      )}

      {/* Delete Card Confirmation Dialog */}
      <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the {cardToDelete?.brand} card ending in {cardToDelete?.last4}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
