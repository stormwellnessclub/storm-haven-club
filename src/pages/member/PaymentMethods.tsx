import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Loader2, AlertCircle, Trash2, Star, Pencil, Check, X } from "lucide-react";
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
  nickname: string | null;
  isDefault: boolean;
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
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [editingNicknameId, setEditingNicknameId] = useState<string | null>(null);
  const [editNicknameValue, setEditNicknameValue] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

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

  const handleSetDefault = async (paymentMethodId: string) => {
    if (!membership?.id) return;

    setSettingDefaultId(paymentMethodId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "set_default_payment_method",
          paymentMethodId,
          memberId: membership.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Default payment method updated");
      refetch();
    } catch (error) {
      console.error("Set default error:", error);
      toast.error("Failed to update default card. Please try again.");
    } finally {
      setSettingDefaultId(null);
    }
  };

  const startEditingNickname = (method: PaymentMethod) => {
    setEditingNicknameId(method.id);
    setEditNicknameValue(method.nickname || "");
  };

  const cancelEditingNickname = () => {
    setEditingNicknameId(null);
    setEditNicknameValue("");
  };

  const handleSaveNickname = async (paymentMethodId: string) => {
    setSavingNickname(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { 
          action: "update_payment_method_nickname",
          paymentMethodId,
          nickname: editNicknameValue.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Card nickname updated");
      refetch();
      cancelEditingNickname();
    } catch (error) {
      console.error("Update nickname error:", error);
      toast.error("Failed to update nickname. Please try again.");
    } finally {
      setSavingNickname(false);
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
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center border flex-shrink-0 ${getCardBrandIcon(method.brand)}`}>
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium capitalize">{method.brand}</p>
                          <span className="text-muted-foreground">•••• {method.last4}</span>
                          {method.isDefault && (
                            <Badge variant="default" className="text-xs bg-accent text-accent-foreground">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Default
                            </Badge>
                          )}
                        </div>
                        
                        {/* Nickname display/edit */}
                        {editingNicknameId === method.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              value={editNicknameValue}
                              onChange={(e) => setEditNicknameValue(e.target.value)}
                              placeholder="Card nickname"
                              className="h-7 text-sm max-w-[200px]"
                              maxLength={50}
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSaveNickname(method.id)}
                              disabled={savingNickname}
                            >
                              {savingNickname ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={cancelEditingNickname}
                              disabled={savingNickname}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5">
                            {method.nickname ? (
                              <p className="text-sm text-muted-foreground italic">"{method.nickname}"</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                              </p>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => startEditingNickname(method)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        
                        {method.nickname && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!method.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                          disabled={settingDefaultId === method.id}
                          className="text-xs"
                        >
                          {settingDefaultId === method.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Set Default"
                          )}
                        </Button>
                      )}
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
                  The card marked as "Default" will be used for your recurring membership charges.
                  You can add nicknames to help identify your cards.
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
