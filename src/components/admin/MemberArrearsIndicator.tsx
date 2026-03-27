import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

/**
 * Lightweight component for the members list table.
 * Queries billing_arrears for a single member and shows a red badge if they owe money.
 */
export function MemberArrearsIndicator({ memberId }: { memberId: string }) {
  const { data } = useQuery({
    queryKey: ["member-arrears-indicator", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_arrears")
        .select("amount_due_cents, amount_paid_cents")
        .eq("member_id", memberId)
        .in("status", ["unpaid", "partial"]);
      if (error) throw error;
      const total = (data || []).reduce(
        (sum, r) => sum + (r.amount_due_cents - r.amount_paid_cents),
        0
      );
      return total;
    },
    staleTime: 60000,
  });

  if (!data || data <= 0) return null;

  return (
    <Badge variant="destructive" className="text-xs gap-1">
      <DollarSign className="h-3 w-3" />
      ${(data / 100).toFixed(0)} owed
    </Badge>
  );
}
