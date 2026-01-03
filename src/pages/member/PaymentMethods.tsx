import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { AddCardModal } from "@/components/member/AddCardModal";
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

export default function MemberPaymentMethods() {
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [cardToDelete, setCardToDelete] = useState<PaymentMethod | null>(null);

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

  const handleAddCardSuccess = () => {
    refetch();
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
      refetch();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove card. Please try again.");
    } finally {
      setDeletingCardId(null);
      setCardToDelete(null);
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
                onClick={() => setIsAddCardModalOpen(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Card
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
                <Button onClick={() => setIsAddCardModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment Method
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

        {/* Info Card */}
        <Card className="bg-secondary/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About Payment Methods</p>
                <p>
                  Your saved cards are used for membership billing and any purchases you make.
                  The first card in the list is your default payment method. You can add new 
                  cards or remove existing ones at any time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Card Modal */}
      <AddCardModal
        open={isAddCardModalOpen}
        onOpenChange={setIsAddCardModalOpen}
        onSuccess={handleAddCardSuccess}
        memberId={membership.id}
      />

      {/* Delete Confirmation Dialog */}
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
    </MemberLayout>
  );
}
