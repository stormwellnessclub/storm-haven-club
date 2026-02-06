import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, CreditCard, XCircle, CalendarX } from "lucide-react";

interface MemberIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  shortLabel: string;
}

interface MemberIssuesBadgesProps {
  issues: MemberIssue[] | undefined;
  compact?: boolean;
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
      return <XCircle className="h-3 w-3" />;
    default:
      return <AlertTriangle className="h-3 w-3" />;
  }
};

export function MemberIssuesBadges({ issues, compact = false }: MemberIssuesBadgesProps) {
  if (!issues || issues.length === 0) {
    return null;
  }

  // In compact mode, show a single summary badge
  if (compact && issues.length > 1) {
    const errorCount = issues.filter((i) => i.type === "error").length;
    const warningCount = issues.filter((i) => i.type === "warning").length;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={
                errorCount > 0
                  ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-xs cursor-help"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-xs cursor-help"
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
        {displayIssues.map((issue, idx) => (
          <Tooltip key={idx}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={
                  issue.type === "error"
                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-xs cursor-help"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 text-xs cursor-help"
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
        ))}
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
