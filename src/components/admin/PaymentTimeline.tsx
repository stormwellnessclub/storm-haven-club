import { useState, useMemo } from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { 
  useAdminPaymentTimeline, 
  PaymentTimelineEvent, 
  PaymentEventType 
} from "@/hooks/useAdminPaymentTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw,
  Info,
  CreditCard,
  DollarSign,
  PlayCircle,
  PauseCircle,
  StopCircle,
  RefreshCcw,
  ExternalLink,
  Calendar as CalendarIcon,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentTimelineProps {
  memberId: string | undefined;
  maxItems?: number;
  showFilters?: boolean;
}

const EVENT_TYPE_LABELS: Record<PaymentEventType, string> = {
  subscription_created: "Subscription Created",
  subscription_updated: "Subscription Updated",
  subscription_canceled: "Subscription Canceled",
  subscription_paused: "Subscription Paused",
  subscription_resumed: "Subscription Resumed",
  invoice_paid: "Invoice Paid",
  invoice_failed: "Invoice Failed",
  payment_succeeded: "Payment Succeeded",
  payment_failed: "Payment Failed",
  refund_processed: "Refund Processed",
  manual_charge: "Manual Charge",
  card_added: "Card Added",
  card_updated: "Card Updated",
  initiation_fee: "Initiation Fee",
  annual_fee: "Annual Fee",
  status_change: "Status Change",
};

const EVENT_CATEGORIES = {
  all: "All Events",
  payments: "Payments",
  subscriptions: "Subscriptions",
  cards: "Cards",
  refunds: "Refunds",
};

const CATEGORY_TYPES: Record<string, PaymentEventType[]> = {
  payments: ['invoice_paid', 'invoice_failed', 'payment_succeeded', 'payment_failed', 'manual_charge', 'initiation_fee', 'annual_fee'],
  subscriptions: ['subscription_created', 'subscription_updated', 'subscription_canceled', 'subscription_paused', 'subscription_resumed', 'status_change'],
  cards: ['card_added', 'card_updated'],
  refunds: ['refund_processed'],
};

function getEventIcon(event: PaymentTimelineEvent) {
  const iconClass = "h-4 w-4";
  
  switch (event.type) {
    case 'subscription_created':
      return <PlayCircle className={cn(iconClass, "text-green-500")} />;
    case 'subscription_canceled':
      return <StopCircle className={cn(iconClass, "text-red-500")} />;
    case 'subscription_paused':
      return <PauseCircle className={cn(iconClass, "text-amber-500")} />;
    case 'subscription_resumed':
      return <RefreshCcw className={cn(iconClass, "text-green-500")} />;
    case 'subscription_updated':
    case 'status_change':
      return <Info className={cn(iconClass, "text-blue-500")} />;
    case 'invoice_paid':
    case 'payment_succeeded':
      return <CheckCircle2 className={cn(iconClass, "text-green-500")} />;
    case 'invoice_failed':
    case 'payment_failed':
      return <XCircle className={cn(iconClass, "text-red-500")} />;
    case 'refund_processed':
      return <RotateCcw className={cn(iconClass, "text-purple-500")} />;
    case 'manual_charge':
    case 'initiation_fee':
    case 'annual_fee':
      return <DollarSign className={cn(iconClass, "text-emerald-500")} />;
    case 'card_added':
    case 'card_updated':
      return <CreditCard className={cn(iconClass, "text-blue-500")} />;
    default:
      return <Clock className={cn(iconClass, "text-muted-foreground")} />;
  }
}

function getStatusBadge(status: PaymentTimelineEvent['status']) {
  switch (status) {
    case 'success':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs">Success</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-xs">Pending</Badge>;
    case 'failed':
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-xs">Failed</Badge>;
    case 'refunded':
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs">Refunded</Badge>;
    case 'info':
      return <Badge variant="outline" className="text-xs">Info</Badge>;
    default:
      return null;
  }
}

function getStripeLink(event: PaymentTimelineEvent): string | null {
  if (!event.stripeObjectId) return null;
  
  const baseUrl = "https://dashboard.stripe.com";
  
  switch (event.stripeObjectType) {
    case 'payment_intent':
      return `${baseUrl}/payments/${event.stripeObjectId}`;
    case 'subscription':
      return `${baseUrl}/subscriptions/${event.stripeObjectId}`;
    case 'invoice':
      return `${baseUrl}/invoices/${event.stripeObjectId}`;
    case 'refund':
      return `${baseUrl}/refunds/${event.stripeObjectId}`;
    case 'charge':
      return `${baseUrl}/payments/${event.stripeObjectId}`;
    default:
      return null;
  }
}

export function PaymentTimeline({ memberId, maxItems = 50, showFilters = true }: PaymentTimelineProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  // Convert category to event types for the query
  const eventTypes = useMemo(() => {
    if (categoryFilter === "all") return undefined;
    return CATEGORY_TYPES[categoryFilter] || undefined;
  }, [categoryFilter]);
  
  const { data: events, isLoading, error } = useAdminPaymentTimeline(memberId, {
    dateFrom,
    dateTo,
    eventTypes,
  });
  
  const displayedEvents = useMemo(() => {
    if (!events) return [];
    return events.slice(0, maxItems);
  }, [events, maxItems]);
  
  const hasActiveFilters = categoryFilter !== "all" || dateFrom || dateTo;
  
  const clearFilters = () => {
    setCategoryFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };
  
  const toggleEventExpanded = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load payment timeline</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment Timeline
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs ml-2">
                {displayedEvents.length} of {events?.length || 0}
              </Badge>
            )}
          </CardTitle>
          
          {showFilters && (
            <Button
              size="sm"
              variant={showFilterPanel ? "secondary" : "ghost"}
              className="h-8"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
          )}
        </div>
        
        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={clearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Category Filter */}
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select 
                  value={categoryFilter} 
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_CATEGORIES).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date From */}
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 w-full justify-start text-left font-normal text-xs",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Date To */}
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 w-full justify-start text-left font-normal text-xs",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateTo ? format(dateTo, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {displayedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {hasActiveFilters ? "No events match your filters" : "No payment events recorded"}
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-0">
              {displayedEvents.map((event, index) => {
                const stripeLink = getStripeLink(event);
                const isExpanded = expandedEvents.has(event.id);
                const hasMetadata = event.metadata && Object.keys(event.metadata).filter(k => event.metadata![k]).length > 0;
                
                return (
                  <div 
                    key={event.id}
                    className={cn(
                      "relative pl-10 py-3 hover:bg-muted/30 rounded-lg transition-colors",
                      index !== displayedEvents.length - 1 && "border-b border-border/50"
                    )}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-2 top-4 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
                      {getEventIcon(event)}
                    </div>
                    
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{event.title}</span>
                          {getStatusBadge(event.status)}
                          {event.amount && (
                            <span className="text-sm font-medium text-muted-foreground">
                              ${(event.amount / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {event.description}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(event.date), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          
                          {stripeLink && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={stripeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Stripe
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View in Stripe Dashboard</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {hasMetadata && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 text-xs"
                              onClick={() => toggleEventExpanded(event.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              Details
                            </Button>
                          )}
                        </div>
                        
                        {/* Expanded metadata */}
                        {isExpanded && hasMetadata && (
                          <div className="mt-2 p-2 rounded bg-muted/50 text-xs space-y-1">
                            {Object.entries(event.metadata!).map(([key, value]) => {
                              if (!value) return null;
                              return (
                                <div key={key} className="flex gap-2">
                                  <span className="text-muted-foreground capitalize">
                                    {key.replace(/_/g, ' ')}:
                                  </span>
                                  <span className="font-mono">
                                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {events && events.length > maxItems && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Showing {displayedEvents.length} of {events.length} events
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
