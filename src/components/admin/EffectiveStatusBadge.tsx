import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  CalendarX,
  Snowflake,
  Clock,
  Ban,
  ShieldX,
} from "lucide-react";

export interface EffectiveStatus {
  status: 'active' | 'payment_failed' | 'no_subscription' | 'no_card' | 'pending_activation' | 'frozen' | 'past_due' | 'cancelled' | 'expired' | 'suspended' | 'blocked';
  canCheckIn: boolean;
  label: string;
  description: string;
}

export interface MemberBillingIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  shortLabel: string;
}

interface EffectiveStatusBadgeProps {
  memberStatus: string;
  billingIssues?: MemberBillingIssue[];
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function getEffectiveStatus(
  memberStatus: string,
  billingIssues?: MemberBillingIssue[]
): EffectiveStatus {
  const issues = billingIssues || [];
  const status = memberStatus?.toLowerCase() || '';

  // Check for payment failures FIRST — these override all other statuses
  const hasFailedPayment = issues.some(i =>
    i.code === 'failed_payment' ||
    i.code === 'subscription_incomplete' ||
    i.code === 'subscription_incomplete_expired' ||
    i.code === 'subscription_past_due' ||
    i.code === 'subscription_canceled'
  );

  if (hasFailedPayment) {
    const pastDueIssue = issues.find(i => i.code === 'subscription_past_due');
    if (pastDueIssue) {
      return {
        status: 'payment_failed',
        canCheckIn: false,
        label: pastDueIssue.shortLabel || 'Past Due',
        description: `${pastDueIssue.message} - access denied`,
      };
    }
    return {
      status: 'payment_failed',
      canCheckIn: false,
      label: 'Payment Failed',
      description: 'Recent payment failure - access denied',
    };
  }

  // Then check non-billable terminal states
  if (status === 'cancelled' || status === 'expired') {
    return {
      status: status as 'cancelled' | 'expired',
      canCheckIn: false,
      label: status === 'cancelled' ? 'Cancelled' : 'Expired',
      description: `Membership ${status}`,
    };
  }

  if (status === 'frozen') {
    return {
      status: 'frozen',
      canCheckIn: false,
      label: 'Frozen',
      description: 'Membership is temporarily frozen',
    };
  }

  if (status === 'suspended') {
    return {
      status: 'suspended',
      canCheckIn: false,
      label: 'Suspended',
      description: 'Membership is suspended',
    };
  }

  if (status === 'pending_activation') {
    return {
      status: 'pending_activation',
      canCheckIn: false,
      label: 'Pending Activation',
      description: 'Awaiting first payment or activation',
    };
  }

  // For active or past_due members, check remaining payment health
  const hasMissingSubscription = issues.some(i => i.code === 'missing_subscription');
  const hasMissingPaymentMethod = issues.some(i => i.code === 'missing_payment_method');

  // hasFailedPayment already handled above

  if (status === 'past_due') {
    const duesIssue = issues.find(i => i.code === 'subscription_past_due' || i.code === 'failed_payment');
    return {
      status: 'past_due',
      canCheckIn: false,
      label: duesIssue?.shortLabel || 'Past Due',
      description: duesIssue ? `${duesIssue.message} - access denied` : 'Subscription past due - access denied',
    };
  }

  if (status === 'active') {
    if (hasMissingSubscription) {
      return {
        status: 'no_subscription',
        canCheckIn: false,
        label: 'No Subscription',
        description: 'Active member without recurring subscription',
      };
    }

    if (hasMissingPaymentMethod) {
      return {
        status: 'no_card',
        canCheckIn: false,
        label: 'No Card',
        description: 'No payment method on file',
      };
    }

    // Truly active with no issues
    return {
      status: 'active',
      canCheckIn: true,
      label: 'Active',
      description: 'Member in good standing - access granted',
    };
  }

  // Fallback for unknown status
  return {
    status: 'cancelled',
    canCheckIn: false,
    label: memberStatus || 'Unknown',
    description: `Status: ${memberStatus || 'Unknown'}`,
  };
}

const statusConfig: Record<EffectiveStatus['status'], {
  icon: React.ElementType;
  badgeClass: string;
  iconClass: string;
}> = {
  active: {
    icon: CheckCircle2,
    badgeClass: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  payment_failed: {
    icon: XCircle,
    badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  no_subscription: {
    icon: CalendarX,
    badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  no_card: {
    icon: CreditCard,
    badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  pending_activation: {
    icon: Clock,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  frozen: {
    icon: Snowflake,
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  past_due: {
    icon: AlertTriangle,
    badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  suspended: {
    icon: Ban,
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800',
    iconClass: 'text-orange-600 dark:text-orange-400',
  },
  cancelled: {
    icon: XCircle,
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    iconClass: 'text-gray-600 dark:text-gray-400',
  },
  expired: {
    icon: XCircle,
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    iconClass: 'text-gray-600 dark:text-gray-400',
  },
  blocked: {
    icon: ShieldX,
    badgeClass: 'bg-red-950 text-red-100 border-red-800 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
    iconClass: 'text-red-300 dark:text-red-400',
  },
};

export function EffectiveStatusBadge({
  memberStatus,
  billingIssues,
  showTooltip = true,
  size = 'md',
}: EffectiveStatusBadgeProps) {
  const effectiveStatus = getEffectiveStatus(memberStatus, billingIssues);
  const config = statusConfig[effectiveStatus.status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const badge = (
    <Badge
      variant="outline"
      className={`${config.badgeClass} ${sizeClasses[size]} font-medium inline-flex items-center gap-1`}
    >
      <Icon className={`${iconSizes[size]} ${config.iconClass}`} />
      {effectiveStatus.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{effectiveStatus.label}</p>
            <p className="text-xs text-muted-foreground">{effectiveStatus.description}</p>
            {!effectiveStatus.canCheckIn && (
              <p className="text-xs text-red-500 font-medium">Cannot check in</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simplified badge for scanner/check-in that just shows access status
export function AccessStatusBadge({
  canCheckIn,
  reason,
  size = 'lg',
}: {
  canCheckIn: boolean;
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  if (canCheckIn) {
    return (
      <Badge
        variant="outline"
        className={`bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700 ${sizeClasses[size]} font-semibold inline-flex items-center gap-1.5`}
      >
        <CheckCircle2 className={iconSizes[size]} />
        Access Granted
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700 ${sizeClasses[size]} font-semibold inline-flex items-center gap-1.5 cursor-help`}
          >
            <XCircle className={iconSizes[size]} />
            Access Denied
          </Badge>
        </TooltipTrigger>
        {reason && (
          <TooltipContent side="top">
            <p className="text-xs">{reason}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
