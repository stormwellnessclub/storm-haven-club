import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface ChargeHistoryProps {
  applicationId?: string;
  memberId?: string;
  showTitle?: boolean;
  maxItems?: number;
}

interface Charge {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
}

export function ChargeHistory({ applicationId, memberId, showTitle = true, maxItems }: ChargeHistoryProps) {
  const { data: charges, isLoading } = useQuery({
    queryKey: ["charge-history", applicationId, memberId],
    queryFn: async () => {
      let query = supabase
        .from("manual_charges")
        .select("id, amount, description, status, created_at, stripe_payment_intent_id")
        .order("created_at", { ascending: false });
      
      if (applicationId) {
        query = query.eq("application_id", applicationId);
      } else if (memberId) {
        query = query.eq("member_id", memberId);
      } else {
        return [];
      }
      
      if (maxItems) {
        query = query.limit(maxItems);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Charge[];
    },
    enabled: !!(applicationId || memberId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {showTitle && <Skeleton className="h-5 w-32" />}
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!charges || charges.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No charges recorded
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Charge History</p>
        </div>
      )}
      <div className="space-y-2">
        {charges.map((charge) => (
          <div
            key={charge.id}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border"
          >
            <div className="space-y-1">
              <p className="font-medium text-sm">{charge.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(charge.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                ${(charge.amount / 100).toFixed(2)}
              </span>
              {getStatusBadge(charge.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}