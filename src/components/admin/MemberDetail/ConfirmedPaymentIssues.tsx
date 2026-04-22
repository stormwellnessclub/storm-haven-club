import { useMemo, useState } from "react";
import { format, toZonedTime } from "date-fns-tz";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_LABELS,
  ConfirmedIssue,
  ConfirmedIssueCategory,
  useMemberConfirmedIssues,
} from "@/hooks/useMemberConfirmedIssues";

const TIMEZONE = "America/Detroit";
const CATEGORY_ORDER: ConfirmedIssueCategory[] = [
  "membership_dues",
  "annual_fee",
  "cafe",
  "spa",
  "shop",
  "pos_other",
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = toZonedTime(new Date(iso), TIMEZONE);
    return format(d, "MMM d, yyyy h:mm a", { timeZone: TIMEZONE });
  } catch {
    return iso;
  }
}

function formatAmount(amountInDollars: number, currency: string | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
  }).format(amountInDollars);
}

function stripeUrl(issue: ConfirmedIssue): string | null {
  if (issue.stripe_invoice_id) return `https://dashboard.stripe.com/invoices/${issue.stripe_invoice_id}`;
  if (issue.stripe_charge_id) return `https://dashboard.stripe.com/payments/${issue.stripe_charge_id}`;
  if (issue.stripe_payment_intent_id) return `https://dashboard.stripe.com/payments/${issue.stripe_payment_intent_id}`;
  return null;
}

interface Props {
  memberId: string;
}

export function ConfirmedPaymentIssues({ memberId }: Props) {
  const { data: issues, isLoading, markResolved, retryCharge } = useMemberConfirmedIssues(memberId);
  const [resolveTarget, setResolveTarget] = useState<ConfirmedIssue | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<ConfirmedIssueCategory, ConfirmedIssue[]>();
    for (const i of issues ?? []) {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    }
    return map;
  }, [issues]);

  const total = issues?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-destructive" />
              Confirmed Payment Issues
            </CardTitle>
            <CardDescription>
              Real, unresolved declines and active disputes — cafe/spa failures appear here for visibility but never block check-in.
            </CardDescription>
          </div>
          {total > 0 && (
            <Badge variant="destructive" className="shrink-0">
              {total} open
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : total === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent/5 p-4">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
            <div>
              <div className="font-medium text-accent">
                No outstanding payment issues
              </div>
              <div className="text-sm text-muted-foreground">
                All recent charges either succeeded or were superseded by a successful retry.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {CATEGORY_ORDER.filter((c) => (grouped.get(c)?.length ?? 0) > 0).map((cat, idx) => {
              const rows = grouped.get(cat)!;
              return (
                <div key={cat}>
                  {idx > 0 && <Separator className="mb-5" />}
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABELS[cat]}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {rows.length} {rows.length === 1 ? "issue" : "issues"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((issue) => {
                      const link = stripeUrl(issue);
                      const reason =
                        issue.decline_reason ??
                        issue.failure_message ??
                        (issue.is_disputed ? `Dispute: ${issue.dispute_reason ?? "unknown"}` : "Unknown");
                      return (
                        <div
                          key={issue.id}
                          className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {formatAmount(issue.amount, issue.currency)}
                              </span>
                              {issue.is_disputed && (
                                <Badge variant="outline" className="border-destructive/50 text-destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Disputed{issue.dispute_status ? ` · ${issue.dispute_status}` : ""}
                                </Badge>
                              )}
                              {!issue.is_disputed && (
                                <Badge variant="destructive">Failed</Badge>
                              )}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {reason}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDate(issue.failed_at ?? issue.disputed_at ?? issue.created_at)}
                              {issue.invoice_number ? ` · Invoice ${issue.invoice_number}` : ""}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                            {!issue.is_disputed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => retryCharge.mutate({ attemptId: issue.id })}
                                disabled={retryCharge.isPending}
                              >
                                {retryCharge.isPending && retryCharge.variables?.attemptId === issue.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Retry
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setResolveTarget(issue);
                                setResolveNote("");
                              }}
                            >
                              Mark resolved
                            </Button>
                            {link && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Stripe
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as resolved</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the issue from the open list. Use when the charge was settled outside of the system or
              the failure no longer needs action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-note">Note (optional)</Label>
            <Textarea
              id="resolve-note"
              placeholder="e.g. Member paid in cash · Retried successfully outside system"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resolveTarget) {
                  markResolved.mutate(
                    { attemptId: resolveTarget.id, note: resolveNote },
                    { onSettled: () => setResolveTarget(null) },
                  );
                }
              }}
            >
              Mark resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
