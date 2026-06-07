import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  XCircle,
  CreditCard,
  Bell,
  Clock,
  History,
} from "lucide-react";
import { useDunningTimeline, type DunningEventType, type DunningTimelineEvent } from "@/hooks/useDunningTimeline";
import { cn } from "@/lib/utils";

interface Props {
  memberId: string | undefined;
  maxItems?: number;
  defaultCollapsed?: boolean;
}

const FILTERS: { key: "all" | "emails" | "retries" | "outreach" | "status"; label: string; types: DunningEventType[] | null }[] = [
  { key: "all", label: "All", types: null },
  { key: "emails", label: "Emails", types: ["dunning_email_sent"] },
  { key: "retries", label: "Retries", types: ["retry_failed", "retry_succeeded", "admin_charge"] },
  { key: "outreach", label: "Outreach", types: ["outreach"] },
  { key: "status", label: "Status", types: ["dunning_started", "dunning_resolved", "dunning_abandoned"] },
];

function iconFor(type: DunningEventType) {
  switch (type) {
    case "dunning_started":
      return <AlertCircle className="h-4 w-4" />;
    case "dunning_email_sent":
      return <Mail className="h-4 w-4" />;
    case "dunning_resolved":
      return <CheckCircle2 className="h-4 w-4" />;
    case "dunning_abandoned":
      return <XCircle className="h-4 w-4" />;
    case "retry_failed":
      return <XCircle className="h-4 w-4" />;
    case "retry_succeeded":
      return <CheckCircle2 className="h-4 w-4" />;
    case "admin_charge":
      return <CreditCard className="h-4 w-4" />;
    case "outreach":
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function toneClasses(status: DunningTimelineEvent["status"]) {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200/60";
    case "failed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200/60";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function money(cents?: number) {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export function DunningTimeline({ memberId, maxItems = 50, defaultCollapsed = false }: Props) {
  const { data: events = [], isLoading } = useDunningTimeline(memberId);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const filtered = f.types ? events.filter((e) => f.types!.includes(e.type)) : events;
    return filtered.slice(0, maxItems);
  }, [events, filter, maxItems]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Dunning Activity</CardTitle>
          <Badge variant="secondary" className="text-xs">{events.length}</Badge>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "Show" : "Hide"}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No dunning activity yet.
            </div>
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-3">
              {visible.map((e) => (
                <li key={e.id} className="pl-4 relative">
                  <span
                    className={cn(
                      "absolute -left-[10px] top-1 flex h-5 w-5 items-center justify-center rounded-full border",
                      toneClasses(e.status),
                    )}
                  >
                    {iconFor(e.type)}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{e.title}</div>
                      {e.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 break-words">{e.description}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(e.date), "MMM d, yyyy h:mm a")}
                        <span className="opacity-60">· {formatDistanceToNow(new Date(e.date), { addSuffix: true })}</span>
                        {e.metadata?.created_by_email && (
                          <span className="opacity-60">· by {e.metadata.created_by_email}</span>
                        )}
                      </div>
                    </div>
                    {money(e.amount_cents) && (
                      <div className={cn("text-sm font-semibold whitespace-nowrap", e.status === "failed" && "text-destructive")}>
                        {money(e.amount_cents)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default DunningTimeline;
