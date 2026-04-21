import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Ban,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Scale,
  Loader2,
} from "lucide-react";
import type { ArrearsClassification, ArrearReconcileResult } from "@/hooks/useArrearsReconciliation";
import { formatInTimeZone } from "date-fns-tz";

interface Props {
  classification?: ArrearsClassification;
  result?: ArrearReconcileResult;
  loading?: boolean;
}

const ET = "America/Detroit";

const config: Record<
  ArrearsClassification,
  { label: string; icon: React.ElementType; className: string }
> = {
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  },
  retrying: {
    label: "Retrying",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200",
  },
  superseded: {
    label: "Superseded",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200",
  },
  disputed: {
    label: "Disputed",
    icon: Scale,
    className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200",
  },
  action_needed: {
    label: "Action Needed",
    icon: AlertCircle,
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  },
  needs_review: {
    label: "Needs Review",
    icon: HelpCircle,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-200",
  },
};

function fmtET(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatInTimeZone(new Date(iso), ET, "MMM d, h:mma zzz");
  } catch {
    return iso;
  }
}

export function ArrearsClassificationBadge({ classification, result, loading }: Props) {
  if (loading) {
    return (
      <Badge variant="outline" className="bg-muted/40 text-muted-foreground">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking…
      </Badge>
    );
  }

  const cls = classification ?? result?.classification;
  if (!cls) {
    return (
      <Badge variant="outline" className="bg-muted/30 text-muted-foreground">
        <HelpCircle className="h-3 w-3 mr-1" />
        Not reconciled
      </Badge>
    );
  }

  const c = config[cls];
  const Icon = c.icon;
  const badge = (
    <Badge variant="outline" className={`${c.className} inline-flex items-center gap-1 font-medium`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );

  if (!result) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1.5 text-xs">
            <p className="font-semibold">{c.label}</p>
            <p className="text-muted-foreground">{result.reason_detail}</p>
            {result.application_status && (
              <p>
                <span className="text-muted-foreground">Application:</span>{" "}
                <span className="font-medium">{result.application_status}</span>
                {result.member_was_pending_activation && (
                  <span className="text-muted-foreground"> (was pending activation)</span>
                )}
              </p>
            )}
            {result.member_status && (
              <p>
                <span className="text-muted-foreground">Member:</span>{" "}
                <span className="font-medium">{result.member_status}</span>
              </p>
            )}
            {result.stripe_subscription_status && (
              <p>
                <span className="text-muted-foreground">Stripe sub:</span>{" "}
                <span className="font-medium">{result.stripe_subscription_status}</span>
              </p>
            )}
            {cls === "retrying" && result.next_retry_at && (
              <p>
                <span className="text-muted-foreground">Next retry (ET):</span>{" "}
                <span className="font-medium">{fmtET(result.next_retry_at)}</span>
              </p>
            )}
            {result.later_successful_charges.length > 0 && (
              <p>
                <span className="text-muted-foreground">Later succeeded:</span>{" "}
                <span className="font-medium">{result.later_successful_charges.length} charge(s)</span>
              </p>
            )}
            {result.this_charge_disputed && (
              <p className="text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> This charge is disputed
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
