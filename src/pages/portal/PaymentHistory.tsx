import { useState, Fragment } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, Loader2, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatInTimeZone } from "date-fns-tz";

interface LineItem {
  name: string;
  quantity: number;
  unit_price: number;
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number; // cents
  status: string;
  type: "charge" | "pass_purchase";
  note?: string | null;
  lineItems?: LineItem[];
  subtotalCents?: number | null;
  taxCents?: number | null;
  processingFeeCents?: number | null;
  declineCode?: string | null;
  declineReason?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  paymentIntentId?: string | null;
}

const TZ = "America/Detroit";
const fmtDate = (iso: string) => formatInTimeZone(new Date(iso), TZ, "MMM d, yyyy");
const fmtDateTime = (iso: string) => formatInTimeZone(new Date(iso), TZ, "MMM d, yyyy · h:mm a zzz");

export default function PortalPaymentHistory() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const { data: payments, isLoading } = useQuery({
    queryKey: ["portal-payment-history", user?.id],
    queryFn: async (): Promise<PaymentRecord[]> => {
      if (!user) return [];

      const { data: charges } = await supabase
        .from("manual_charges")
        .select("id, amount, description, status, created_at, failed_at, note, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: passes } = await supabase
        .from("class_passes")
        .select("id, price_paid, category, pass_type, status, purchased_at")
        .eq("user_id", user.id)
        .gt("price_paid", 0)
        .order("purchased_at", { ascending: false });

      const records: PaymentRecord[] = [];

      (charges || []).forEach((c: any) => {
        const meta = c.metadata || {};
        records.push({
          id: c.id,
          date: c.failed_at || c.created_at,
          description: c.description || "Charge",
          amount: c.amount,
          status: c.status || "pending",
          type: "charge",
          note: c.note,
          lineItems: Array.isArray(meta.line_items) ? meta.line_items : [],
          subtotalCents: meta.subtotal_cents ?? null,
          taxCents: meta.tax_cents ?? null,
          processingFeeCents: meta.processing_fee_cents ?? null,
          declineCode: meta.decline_code ?? null,
          declineReason: meta.decline_reason ?? null,
          cardBrand: meta.card_brand ?? null,
          cardLast4: meta.card_last4 ?? null,
        });
      });

      (passes || []).forEach((p) => {
        records.push({
          id: p.id,
          date: p.purchased_at,
          description: `${p.pass_type} — ${p.category}`,
          amount: p.price_paid * 100,
          status: p.status === "active" || p.status === "exhausted" ? "succeeded" : p.status,
          type: "pass_purchase",
        });
      });

      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return records;
    },
    enabled: !!user,
  });

  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Badge variant="default">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="outline">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const hasDetails = (p: PaymentRecord) =>
    p.type === "charge" &&
    ((p.lineItems && p.lineItems.length > 0) ||
      !!p.note ||
      p.status === "failed" ||
      p.subtotalCents != null ||
      p.taxCents != null ||
      p.processingFeeCents != null ||
      !!p.cardBrand);

  return (
    <PortalLayout title="Payment History">
      <div className="max-w-3xl space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : !payments?.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No payment history yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your charges and receipts will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const isOpen = expanded.has(p.id);
                    const showToggle = hasDetails(p);
                    return (
                      <Fragment key={p.id}>
                        <TableRow
                          key={p.id}
                          className={showToggle ? "cursor-pointer" : ""}
                          onClick={() => showToggle && toggle(p.id)}
                        >
                          <TableCell className="pr-0">
                            {showToggle ? (
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            ) : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                          <TableCell>
                            <div>{p.description}</div>
                            {p.status === "failed" && p.declineReason && (
                              <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {p.declineReason}
                              </div>
                            )}
                            {p.note && !isOpen && (
                              <div className="text-xs text-muted-foreground mt-1 italic truncate max-w-xs">
                                Note: {p.note}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatAmount(p.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(p.status)}</TableCell>
                        </TableRow>
                        {isOpen && showToggle && (
                          <TableRow key={`${p.id}-details`} className="bg-muted/30">
                            <TableCell colSpan={5} className="py-4">
                              <div className="space-y-3 text-sm">
                                <div className="text-xs text-muted-foreground">
                                  {p.status === "failed" ? "Attempted" : "Charged"}: {fmtDateTime(p.date)}
                                </div>

                                {p.lineItems && p.lineItems.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                      Items
                                    </div>
                                    <div className="space-y-1">
                                      {p.lineItems.map((li, i) => (
                                        <div key={i} className="flex justify-between">
                                          <span>
                                            {li.quantity}× {li.name}
                                          </span>
                                          <span className="tabular-nums">
                                            ${(li.quantity * li.unit_price).toFixed(2)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {(p.subtotalCents != null ||
                                  p.taxCents != null ||
                                  p.processingFeeCents != null) && (
                                  <div className="border-t pt-2 space-y-1">
                                    {p.subtotalCents != null && (
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Subtotal</span>
                                        <span>{formatAmount(p.subtotalCents)}</span>
                                      </div>
                                    )}
                                    {p.taxCents != null && (
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Sales Tax</span>
                                        <span>{formatAmount(p.taxCents)}</span>
                                      </div>
                                    )}
                                    {p.processingFeeCents != null && p.processingFeeCents > 0 && (
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Processing Fee</span>
                                        <span>{formatAmount(p.processingFeeCents)}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {p.note && (
                                  <div className="bg-background border rounded-md p-3">
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                      Note from the front desk
                                    </div>
                                    <div>{p.note}</div>
                                  </div>
                                )}

                                {p.status === "failed" && (p.declineCode || p.declineReason) && (
                                  <div className="bg-destructive/5 border border-destructive/30 rounded-md p-3">
                                    <div className="text-xs font-medium uppercase tracking-wide text-destructive mb-1">
                                      Card declined
                                    </div>
                                    {p.declineReason && <div>{p.declineReason}</div>}
                                    {p.declineCode && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Code: {p.declineCode}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-2">
                                      Please update your payment method or contact the front desk to complete this purchase.
                                    </div>
                                  </div>
                                )}

                                {p.cardBrand && (
                                  <div className="text-xs text-muted-foreground">
                                    Payment method: {p.cardBrand} •••• {p.cardLast4 || "****"}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
