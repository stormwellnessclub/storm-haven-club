import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, Mail, User, CreditCard, Clock, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { FailedPayment } from "@/hooks/usePaymentTracking";

interface FailedPaymentDetailSheetProps {
  payment: FailedPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FailedPaymentDetailSheet({
  payment,
  open,
  onOpenChange,
}: FailedPaymentDetailSheetProps) {
  const navigate = useNavigate();

  const { data: allAttempts } = useQuery({
    queryKey: ["member-payment-attempts", payment?.member_id],
    queryFn: async () => {
      if (!payment?.member_id) return [];
      const { data, error } = await supabase
        .from("payment_attempts")
        .select("*")
        .eq("member_id", payment.member_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!payment?.member_id,
  });

  const { data: emailHistory } = useQuery({
    queryKey: ["member-payment-emails", payment?.member_id],
    queryFn: async () => {
      if (!payment?.member_id) return [];
      const { data, error } = await supabase
        .from("email_audit_log")
        .select("*")
        .eq("member_id", payment.member_id)
        .in("email_type", ["payment_failed", "add_card_for_dues"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!payment?.member_id,
  });

  const { data: member } = useQuery({
    queryKey: ["member-card-details", payment?.member_id],
    queryFn: async () => {
      if (!payment?.member_id) return null;
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", payment.member_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!payment?.member_id,
  });

  if (!payment) return null;

  const getDeclineCodeDisplay = (code: string | null) => {
    const codeMap: Record<string, { label: string; description: string }> = {
      insufficient_funds: { label: "Insufficient Funds", description: "Not enough funds in the account" },
      card_declined: { label: "Card Declined", description: "Generic decline by card issuer" },
      expired_card: { label: "Expired Card", description: "Card has expired" },
      incorrect_cvc: { label: "Incorrect CVC", description: "CVC verification failed" },
      processing_error: { label: "Processing Error", description: "Temporary processing issue" },
      do_not_honor: { label: "Do Not Honor", description: "Card issuer refused the transaction" },
    };
    return codeMap[code || ""] || { label: code || "Unknown", description: "Contact card issuer" };
  };

  const declineInfo = getDeclineCodeDisplay(payment.decline_code);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Failed Payment Details
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Member Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{payment.member_name}</h3>
                <p className="text-sm text-muted-foreground">{payment.member_email}</p>
                <Badge variant="outline" className="mt-2">{payment.membership_type}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate(`/admin/members/${payment.member_id}`);
                  onOpenChange(false);
                }}
              >
                <User className="h-4 w-4 mr-1" />
                View Profile
              </Button>
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase">Payment Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-semibold text-lg">${payment.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attempt #</p>
                <p className="font-semibold">{payment.attempt_number || 1}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="destructive">{payment.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{format(new Date(payment.created_at), "MMM d, yyyy h:mm a")}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Decline Info */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase">Decline Reason</h4>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">{declineInfo.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{declineInfo.description}</p>
                  {payment.failure_message && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded">
                      {payment.failure_message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {payment.next_retry_at && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Next retry: {format(new Date(payment.next_retry_at), "MMM d, yyyy h:mm a")}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Card on File */}
          {member && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase">Card on File</h4>
              
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  {member.card_last4 ? (
                    <>
                      <p className="font-medium">{member.card_brand} •••• {member.card_last4}</p>
                      <p className="text-sm text-muted-foreground">
                        Expires {member.card_exp_month}/{member.card_exp_year}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No card on file</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Payment History */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase">Recent Payment Attempts</h4>
            
            <div className="space-y-2">
              {allAttempts?.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={attempt.status === "succeeded" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {attempt.status}
                    </Badge>
                    <span>${attempt.amount}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {format(new Date(attempt.created_at || ""), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
              {(!allAttempts || allAttempts.length === 0) && (
                <p className="text-sm text-muted-foreground">No recent attempts</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Email History */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase">Email History</h4>
            
            <div className="space-y-2">
              {emailHistory?.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{email.email_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={email.status === "sent" ? "secondary" : "outline"}>
                      {email.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {email.sent_at ? format(new Date(email.sent_at), "MMM d") : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
              {(!emailHistory || emailHistory.length === 0) && (
                <p className="text-sm text-muted-foreground">No payment emails sent</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              className="flex-1"
              onClick={() => {
                navigate(`/admin/members/${payment.member_id}`);
                onOpenChange(false);
              }}
            >
              <User className="h-4 w-4 mr-2" />
              View Member
            </Button>
            {payment.invoice_id && (
              <Button
                variant="outline"
                onClick={() => window.open(`https://dashboard.stripe.com/invoices/${payment.invoice_id}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Stripe
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
