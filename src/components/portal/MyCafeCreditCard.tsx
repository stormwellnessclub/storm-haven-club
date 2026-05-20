import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coffee } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useMemberCafeCredit, formatCents } from "@/hooks/useMemberCafeCredit";

export function MyCafeCreditCard() {
  const { user } = useAuth();
  const { data: membership } = useUserMembership();
  const memberId = (membership as any)?.id || null;
  const { data: balance } = useMemberCafeCredit(memberId);

  if (!user || !memberId) return null;
  if (!balance) return null;
  if (balance.balance_cents <= 0 && balance.prepaid_items.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coffee className="h-4 w-4 text-amber-600" />
          Your Cafe Credit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {balance.balance_cents > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Cash balance</span>
            <span className="text-xl font-semibold tabular-nums">{formatCents(balance.balance_cents)}</span>
          </div>
        )}
        {balance.prepaid_items.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Prepaid items</div>
            <div className="flex flex-wrap gap-1">
              {balance.prepaid_items.map((p) => (
                <Badge key={p.menu_item_id} variant="secondary" className="font-normal">
                  {p.quantity_remaining}× {p.item_name}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground pt-1">Applied automatically at the cafe.</p>
      </CardContent>
    </Card>
  );
}
