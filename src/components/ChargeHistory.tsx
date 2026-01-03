import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, CheckCircle, Clock, XCircle, Mail, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface ChargeHistoryProps {
  applicationId?: string;
  memberId?: string;
  showTitle?: boolean;
  maxItems?: number;
  // Admin props for resend functionality
  isAdmin?: boolean;
  recipientEmail?: string;
  recipientName?: string;
}

interface Charge {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
}

export function ChargeHistory({ 
  applicationId, 
  memberId, 
  showTitle = true, 
  maxItems,
  isAdmin = false,
  recipientEmail,
  recipientName,
}: ChargeHistoryProps) {
  const [resendingId, setResendingId] = useState<string | null>(null);

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

  const handleResendReceipt = async (charge: Charge) => {
    if (!recipientEmail || !recipientName) {
      toast.error("Recipient information not available");
      return;
    }

    setResendingId(charge.id);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "charge_confirmation",
          to: recipientEmail,
          data: {
            name: recipientName,
            description: charge.description,
            amount: (charge.amount / 100).toFixed(2),
            date: format(parseISO(charge.created_at), "MMMM d, yyyy"),
            cardBrand: "Card",
            cardLast4: "****",
          },
        },
      });

      if (error) throw error;
      toast.success(`Receipt resent to ${recipientEmail}`);
    } catch (err: any) {
      console.error("Failed to resend receipt:", err);
      toast.error(err.message || "Failed to resend receipt");
    } finally {
      setResendingId(null);
    }
  };

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
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border gap-2"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{charge.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(charge.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-semibold">
                ${(charge.amount / 100).toFixed(2)}
              </span>
              {getStatusBadge(charge.status)}
              {isAdmin && charge.status === "succeeded" && recipientEmail && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => handleResendReceipt(charge)}
                  disabled={resendingId === charge.id}
                  title="Resend receipt email"
                >
                  {resendingId === charge.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}