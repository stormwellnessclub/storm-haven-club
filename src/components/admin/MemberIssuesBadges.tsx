import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, XCircle, CalendarX, ExternalLink, Clock, Mail, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface MemberIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  shortLabel: string;
}

interface MemberIssuesBadgesProps {
  issues: MemberIssue[] | undefined;
  compact?: boolean;
  memberId?: string;
}

const getIssueIcon = (code: string) => {
  switch (code) {
    case "missing_subscription":
      return <CalendarX className="h-3 w-3" />;
    case "missing_payment_method":
    case "card_expired":
    case "card_expiring":
      return <CreditCard className="h-3 w-3" />;
    case "failed_payment":
    case "subscription_incomplete":
    case "subscription_incomplete_expired":
      return <XCircle className="h-3 w-3" />;
    default:
      return <AlertTriangle className="h-3 w-3" />;
  }
};

interface FailedPaymentDetailsProps {
  memberId: string;
  onViewMember: () => void;
}

function FailedPaymentDetails({ memberId, onViewMember }: FailedPaymentDetailsProps) {
  const { data: latestAttempt, isLoading } = useQuery({
    queryKey: ["member-latest-payment-attempt", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_attempts")
        .select("*")
        .eq("member_id", memberId)
        .in("status", ["failed", "requires_action"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: emailSent } = useQuery({
    queryKey: ["member-payment-email-sent", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_audit_log")
        .select("id, sent_at")
        .eq("member_id", memberId)
        .eq("email_type", "payment_failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const getDeclineLabel = (code: string | null) => {
    const map: Record<string, string> = {
      insufficient_funds: "Insufficient Funds",
      card_declined: "Card Declined",
      expired_card: "Expired Card",
      incorrect_cvc: "Incorrect CVC",
      processing_error: "Processing Error",
      do_not_honor: "Do Not Honor",
    };
    return map[code || ""] || code || "Unknown";
  };

  if (isLoading) {
    return <div className="p-2 text-xs text-muted-foreground">Loading...</div>;
  }

  if (!latestAttempt) {
    return <div className="p-2 text-xs text-muted-foreground">No failed payment data</div>;
  }

  return (
    <div className="space-y-3 p-1">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-4 w-4" />
          <span className="font-semibold text-sm">Payment Failed</span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <span className="ml-1 font-medium">${latestAttempt.amount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Attempt #:</span>
            <span className="ml-1 font-medium">{latestAttempt.attempt_number || 1}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Decline Code:</span>
            <span className="ml-1 font-medium">{getDeclineLabel(latestAttempt.decline_code)}</span>
          </div>
          {latestAttempt.failure_message && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Message:</span>
              <p className="text-xs mt-0.5 p-1.5 bg-muted rounded">{latestAttempt.failure_message}</p>
            </div>
          )}
          {latestAttempt.next_retry_at && (
            <div className="col-span-2 flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Next retry:</span>
              <span className="font-medium">
                {format(new Date(latestAttempt.next_retry_at), "MMM d, h:mm a")}
              </span>
            </div>
          )}
          <div className="col-span-2 flex items-center gap-1">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Email sent:</span>
            <span className={emailSent ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
              {emailSent ? `Yes (${format(new Date(emailSent.sent_at!), "MMM d")})` : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onViewMember}>
          <User className="h-3 w-3 mr-1" />
          View Member
        </Button>
        {latestAttempt.invoice_id && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => window.open(`https://dashboard.stripe.com/invoices/${latestAttempt.invoice_id}`, "_blank")}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function MemberIssuesBadges({ issues, compact = false, memberId }: MemberIssuesBadgesProps) {
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (!issues || issues.length === 0) {
    return null;
  }

  const failedPaymentIssue = issues.find(
    (i) => i.code === "failed_payment" || i.code === "subscription_incomplete" || i.code === "subscription_incomplete_expired"
  );

  // In compact mode, show a single summary badge
  if (compact && issues.length > 1) {
    const errorCount = issues.filter((i) => i.type === "error").length;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={
                errorCount > 0
                  ? "bg-destructive/10 text-destructive border-destructive/30 text-xs cursor-help"
                  : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 text-xs cursor-help"
              }
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              {issues.length} Issues
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <ul className="text-xs space-y-1">
              {issues.map((issue, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  {getIssueIcon(issue.code)}
                  {issue.message}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show individual badges (max 2)
  const displayIssues = issues.slice(0, 2);
  const remaining = issues.length - 2;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {displayIssues.map((issue, idx) => {
          const isFailedPayment = issue.code === "failed_payment" || issue.code === "subscription_incomplete" || issue.code === "subscription_incomplete_expired";
          
          // For failed payments, use a popover with details
          if (isFailedPayment && memberId) {
            return (
              <Popover key={idx} open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-destructive/30 text-xs cursor-pointer hover:bg-destructive/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {getIssueIcon(issue.code)}
                    <span className="ml-1">{issue.shortLabel}</span>
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
                  <FailedPaymentDetails
                    memberId={memberId}
                    onViewMember={() => {
                      setPopoverOpen(false);
                      navigate(`/admin/members/${memberId}`);
                    }}
                  />
                </PopoverContent>
              </Popover>
            );
          }

          // For other issues, use tooltip
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={
                    issue.type === "error"
                      ? "bg-destructive/10 text-destructive border-destructive/30 text-xs cursor-help"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 text-xs cursor-help"
                  }
                >
                  {getIssueIcon(issue.code)}
                  <span className="ml-1">{issue.shortLabel}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{issue.message}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs cursor-help">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <ul className="text-xs space-y-1">
                {issues.slice(2).map((issue, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    {getIssueIcon(issue.code)}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
