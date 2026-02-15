import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, DollarSign, ExternalLink, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface StripeInvoice {
  id: string;
  number: string | null;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  created: string;
  due_date: string | null;
  attempt_count: number;
  next_payment_attempt: string | null;
  last_failure_message: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  hosted_invoice_url: string | null;
  period_start: string | null;
  period_end: string | null;
}

interface InvoiceSummary {
  total_open: number;
  total_uncollectible: number;
  total_amount_due: number;
}

export function StripeLivePaymentsTab() {
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke('stripe-failed-invoices', {
        body: { status: 'all' },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInvoices(data.invoices || []);
      setSummary(data.summary || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Failed to fetch Stripe invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchInvoices, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchInvoices]);

  const handleRetry = async (invoiceId: string, subscriptionId: string | null) => {
    if (!subscriptionId) {
      toast.error("No subscription linked to this invoice");
      return;
    }
    setRetryingId(invoiceId);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-payment', {
        body: {
          action: 'retry_subscription_invoice',
          subscriptionId,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      toast.success("Payment retry initiated");
      // Refresh after short delay
      setTimeout(fetchInvoices, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Retry failed: ${msg}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchInvoices();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_open ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uncollectible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.total_uncollectible ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <DollarSign className="h-5 w-5" />
              {(summary?.total_amount_due ?? 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Live data from Stripe • {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Invoices Table */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No open or uncollectible invoices found in Stripe.</p>
            <p className="text-xs text-muted-foreground mt-1">All payments are up to date!</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Attempts</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="hidden lg:table-cell">Next Retry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{invoice.customer_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{invoice.customer_email || invoice.customer_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      ${invoice.amount_due.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoice.status === 'open' ? 'destructive' : 'secondary'}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {invoice.attempt_count}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {format(new Date(invoice.created), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {invoice.next_payment_attempt
                      ? format(new Date(invoice.next_payment_attempt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(invoice.id, invoice.subscription_id)}
                        disabled={retryingId === invoice.id || !invoice.subscription_id}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        {retryingId === invoice.id ? '...' : 'Retry'}
                      </Button>
                      {invoice.hosted_invoice_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
