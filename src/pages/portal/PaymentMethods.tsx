import { PortalLayout } from "@/components/portal/PortalLayout";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PortalPaymentMethods() {
  const { profile, isLoading } = useNonMemberProfile();
  const hasCard = profile?.card_last4;

  return (
    <PortalLayout title="Payment Methods">
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Keep a card on file for class bookings, recovery sessions, and other services.
        </p>

        {hasCard ? (
          <Card>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {profile?.card_brand?.toUpperCase()} •••• {profile?.card_last4}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires {profile?.card_exp_month}/{profile?.card_exp_year}
                  </p>
                </div>
              </div>
              <Badge>Default</Badge>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">No payment method on file</p>
              <p className="text-sm text-muted-foreground mb-4">
                A card is required for bookings and purchases.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
