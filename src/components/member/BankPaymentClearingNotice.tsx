import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMembership } from "@/hooks/useUserMembership";

/** Shown while a dues payment from the member's bank account is still clearing. */
export function BankPaymentClearingNotice() {
  const { data: membership } = useUserMembership();
  const { data: clearing } = useQuery({
    queryKey: ["my-bank-payment-clearing", membership?.id],
    enabled: !!membership?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_arrears")
        .select("amount_due_cents")
        .eq("member_id", membership!.id)
        .eq("status", "processing")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  if (!clearing) return null;
  const amount = `$${(clearing.amount_due_cents / 100).toFixed(2)}`;

  return (
    <div className="bg-muted border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-start gap-3">
        <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-foreground">Payment processing — your bank payment is on its way</p>
          <p className="text-sm text-muted-foreground">
            Your {amount} dues payment is clearing with your bank, which can take a few business days. Nothing else is needed from you.
          </p>
        </div>
      </div>
    </div>
  );
}
