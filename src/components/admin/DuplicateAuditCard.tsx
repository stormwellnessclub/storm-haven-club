import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface OrphanSubscription {
  id: string;
  created: string;
  status: string;
  last_invoice_amount: number;
}

interface DuplicateRecord {
  member_id: string;
  member_name: string;
  email: string;
  stripe_customer_id: string;
  linked_subscription_id: string | null;
  orphan_subscriptions: OrphanSubscription[];
}

interface AuditResult {
  duplicates: DuplicateRecord[];
  total_orphans: number;
}

export function DuplicateAuditCard() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const runAudit = async () => {
    setIsAuditing(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: { action: 'audit_duplicate_annual_fees' }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAuditResult(data);
      if (data.total_orphans === 0) {
        toast.success("No duplicate subscriptions found!");
      } else {
        toast.info(`Found ${data.total_orphans} orphan subscription(s) across ${data.duplicates.length} member(s)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run audit';
      setError(message);
      toast.error(message);
    } finally {
      setIsAuditing(false);
    }
  };

  const cancelSubscription = async (subscriptionId: string, processRefund: boolean) => {
    setCancellingIds(prev => new Set(prev).add(subscriptionId));
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: { 
          action: 'cancel_orphan_subscription',
          subscriptionId,
          processRefund
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Subscription cancelled${processRefund ? ' and refunded' : ''}`);
      
      // Remove from local state
      setAuditResult(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          duplicates: prev.duplicates.map(d => ({
            ...d,
            orphan_subscriptions: d.orphan_subscriptions.filter(o => o.id !== subscriptionId)
          })).filter(d => d.orphan_subscriptions.length > 0),
          total_orphans: prev.total_orphans - 1
        };
        return updated;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
      toast.error(message);
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(subscriptionId);
        return next;
      });
    }
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const truncateId = (id: string) => {
    return id.length > 20 ? `${id.slice(0, 12)}...` : id;
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Duplicate Initiation Fee Audit</CardTitle>
          </div>
          <Button onClick={runAudit} disabled={isAuditing} variant="outline" size="sm">
            {isAuditing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Auditing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Audit
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Finds members with multiple active initiation fee subscriptions and identifies orphans (not linked in database).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!auditResult && !isAuditing && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Click "Run Audit" to scan for duplicate subscriptions</p>
          </div>
        )}

        {isAuditing && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Scanning all members for duplicate subscriptions...</p>
            <p className="text-sm">This may take a moment.</p>
          </div>
        )}

        {auditResult && auditResult.total_orphans === 0 && (
          <div className="text-center py-8 text-primary">
            <CheckCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-medium">No duplicates found!</p>
            <p className="text-sm text-muted-foreground">All initiation fee subscriptions are properly linked.</p>
          </div>
        )}

        {auditResult && auditResult.total_orphans > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Found <strong className="text-foreground">{auditResult.total_orphans}</strong> orphan subscription(s) 
                across <strong className="text-foreground">{auditResult.duplicates.length}</strong> member(s)
              </span>
            </div>

            <div className="space-y-3">
              {auditResult.duplicates.map((record) => (
                <Card key={record.member_id} className="p-4 bg-muted/30">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{record.member_name}</p>
                        <p className="text-sm text-muted-foreground">{record.email}</p>
                      </div>
                      {record.linked_subscription_id && (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Linked: {truncateId(record.linked_subscription_id)}
                        </Badge>
                      )}
                    </div>

                    {record.orphan_subscriptions.map((orphan) => (
                      <div 
                        key={orphan.id} 
                        className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/30"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">Orphan</Badge>
                            <code className="text-xs bg-background px-2 py-0.5 rounded">{truncateId(orphan.id)}</code>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created: {format(new Date(orphan.created), 'MMM d, yyyy')} • 
                            Status: {orphan.status} • 
                            Last invoice: {formatAmount(orphan.last_invoice_amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelSubscription(orphan.id, false)}
                            disabled={cancellingIds.has(orphan.id)}
                          >
                            {cancellingIds.has(orphan.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="h-3 w-3 mr-1" />
                                Cancel
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelSubscription(orphan.id, true)}
                            disabled={cancellingIds.has(orphan.id)}
                          >
                            {cancellingIds.has(orphan.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Cancel & Refund
                              </>
                            )}
                          </Button>
                          <a
                            href={`https://dashboard.stripe.com/subscriptions/${orphan.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
