import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate, formatMoney } from "@/lib/privateEvents";
import { toast } from "sonner";

interface InvoiceSummary {
  invoice_id: string;
  kind: string;
  label: string | null;
  amount_cents: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  event_title: string;
  event_date: string | null;
  client_name: string;
}

export default function PrivateEventInvoicePay() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const sessionId = searchParams.get("session_id");
      if (sessionId) {
        await supabase.functions.invoke("private-event-pay", {
          body: { action: "confirm", token, session_id: sessionId },
        });
      }
      const { data, error: fnError } = await supabase.functions.invoke("private-event-pay", {
        body: { action: "get", token },
      });
      if (!active) return;
      if (fnError || data?.error) setError(data?.error ?? "This payment link is no longer valid.");
      else setInvoice(data.invoice);
      setLoading(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [token, searchParams]);

  const pay = async () => {
    setPaying(true);
    const { data, error: fnError } = await supabase.functions.invoke("private-event-pay", {
      body: { action: "checkout", token },
    });
    setPaying(false);
    if (fnError || data?.error) {
      toast.error(data?.error ?? "Could not start checkout");
      return;
    }
    window.location.href = data.url;
  };

  return (
    <Layout>
      <SEOHead
        title="Pay your event invoice | Storm Wellness Club"
        description="Securely pay your private event deposit or balance at Storm Wellness Club."
        noIndex
      />
      <div className="mx-auto max-w-lg px-4 py-16">
        {loading && (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        )}

        {!loading && error && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent></Card>
        )}

        {!loading && invoice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{invoice.event_title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {invoice.kind === "deposit" ? "Deposit" : invoice.label || "Balance"} · {formatEventDate(invoice.event_date)}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md border p-4 text-center">
                <div className="text-sm text-muted-foreground">Amount due</div>
                <div className="text-3xl font-semibold">{formatMoney(invoice.amount_cents)}</div>
                {invoice.due_date && <div className="mt-1 text-xs text-muted-foreground">Due by {invoice.due_date}</div>}
              </div>

              {invoice.status === "paid" ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <CheckCircle className="h-5 w-5" /> Paid — thank you!
                </div>
              ) : (
                <Button className="w-full" size="lg" onClick={pay} disabled={paying}>
                  {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Pay securely by card
                </Button>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Payments are processed securely by Stripe. Questions? Call (248) 232-8487.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
