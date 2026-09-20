import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, FileText, ScrollText, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = {
  id: string;
  classification: "included" | "priced" | "optional" | "internal";
  section: string | null;
  label: string;
  client_description: string | null;
  quantity: number;
  unit_price_cents: number;
  taxable: boolean;
  show_quantity: boolean;
  show_price: boolean;
  selected: boolean;
  client_selectable: boolean;
  sort_order: number;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_type: string;
  label: string | null;
  amount_cents: number;
  amount_paid_cents: number;
  amount_refunded_cents: number;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  pay_token: string;
};

type EventDoc = {
  id: string;
  kind: "proposal" | "contract";
  title: string | null;
  body: string | null;
  terms_body: string | null;
  status: string;
  accepted_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signature_text: string | null;
  invoice_id: string | null;
};

type Payment = {
  id: string;
  invoice_id: string | null;
  direction: "payment" | "refund";
  amount_cents: number;
  method: string | null;
  occurred_at: string;
  notes: string | null;
};

type Totals = {
  baseCents: number;
  enhancementsCents: number;
  discountCents: number;
  serviceChargeCents: number;
  taxCents: number;
  processingFeeCents: number;
  creditCents: number;
  totalCents: number;
};

type PortalData = {
  event: {
    title: string;
    package_name: string | null;
    client_name: string | null;
    client_intro: string | null;
    pricing_mode: string;
    package_price_cents: number | null;
    discount_label: string | null;
    service_charge_label: string | null;
    tax_rate: number;
    tax_enabled: boolean;
    requires_proposal: boolean;
    requires_contract: boolean;
    confirmed_at: string | null;
    event_date: string | null;
    start_time: string | null;
    end_time: string | null;
  };
  items: Item[];
  totals: Totals;
  amount_paid_cents: number;
  balance_cents: number;
  invoices: Invoice[];
  documents: EventDoc[];
  payments: Payment[];
};

function money(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  ready: "Ready",
  sent: "Awaiting payment",
  viewed: "Awaiting payment",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  payment_failed: "Payment failed",
  void: "Void",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export default function EventClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [savingSelections, setSavingSelections] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [acceptName, setAcceptName] = useState("");
  const [signName, setSignName] = useState("");
  const [signature, setSignature] = useState("");
  const [submittingAccept, setSubmittingAccept] = useState(false);
  const [submittingSign, setSubmittingSign] = useState(false);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const { data: res, error: fnError } = await supabase.functions.invoke("event-client-portal", {
        body: { action, token, ...extra },
      });
      if (fnError || res?.error) {
        throw new Error(res?.error ?? "Something went wrong. Please try again.");
      }
      return res;
    },
    [token],
  );

  const load = useCallback(async () => {
    try {
      const res = await call("get");
      setData(res as PortalData);
      const initSelected = new Set<string>(
        (res.items as Item[]).filter((i) => i.classification === "optional" && i.selected).map((i) => i.id),
      );
      setSelectedIds(initSelected);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const sessionId = searchParams.get("session_id");
      if (sessionId) {
        try {
          await call("confirm", { session_id: sessionId });
          toast.success("Payment received — thank you!");
        } catch (e) {
          toast.error((e as Error).message);
        }
        searchParams.delete("session_id");
        setSearchParams(searchParams, { replace: true });
      }
      if (!active) return;
      await load();
    };
    run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const included = useMemo(() => data?.items.filter((i) => i.classification === "included") ?? [], [data]);
  const priced = useMemo(() => data?.items.filter((i) => i.classification === "priced") ?? [], [data]);
  const optional = useMemo(() => data?.items.filter((i) => i.classification === "optional") ?? [], [data]);
  const proposal = useMemo(() => data?.documents.find((d) => d.kind === "proposal") ?? null, [data]);
  const contract = useMemo(() => data?.documents.find((d) => d.kind === "contract") ?? null, [data]);

  const toggleEnhancement = async (item: Item, checked: boolean) => {
    if (!item.client_selectable) return;
    const next = new Set(selectedIds);
    if (checked) next.add(item.id);
    else next.delete(item.id);
    setSelectedIds(next);
    setSavingSelections(true);
    try {
      await call("select_enhancements", { item_ids: Array.from(next) });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSelections(false);
    }
  };

  const handleAccept = async () => {
    if (!proposal || !acceptName.trim()) return;
    setSubmittingAccept(true);
    try {
      await call("accept_proposal", { document_id: proposal.id, name: acceptName.trim() });
      toast.success("Proposal accepted — thank you!");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmittingAccept(false);
    }
  };

  const handleSign = async () => {
    if (!contract || !signName.trim() || !signature.trim()) return;
    setSubmittingSign(true);
    try {
      await call("sign_contract", { document_id: contract.id, name: signName.trim(), signature_text: signature.trim() });
      toast.success("Contract signed — thank you!");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmittingSign(false);
    }
  };

  const handlePay = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    try {
      const res = await call("checkout", { invoice_id: invoiceId });
      window.location.href = res.url;
    } catch (e) {
      toast.error((e as Error).message);
      setPayingInvoiceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Your Event Portal"
        description="Review your Storm Wellness Club private event details, proposal, contract, and payments."
        path={`/event-portal/${token ?? ""}`}
        noindex
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-sm border border-border bg-card px-8 py-16 text-center">
            <p className="font-serif text-2xl text-foreground">This link isn't quite right</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">{error}</p>
            <p className="mt-6 text-xs text-muted-foreground">
              If you believe this is an error, please contact us at (248) 232-8487.
            </p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-16">
            {/* 1. Header */}
            <header className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Storm Wellness Club</p>
              <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">{data.event.title}</h1>
              {data.event.client_name && (
                <p className="mt-3 text-sm text-muted-foreground">Prepared for {data.event.client_name}</p>
              )}
              {data.event.client_intro && (
                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-foreground/80">
                  {data.event.client_intro}
                </p>
              )}
            </header>

            <Separator />

            {/* 2. Included */}
            {included.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-foreground">Your Experience Includes</h2>
                <div className="mt-6 space-y-4">
                  {included.map((item) => (
                    <div key={item.id} className="flex items-baseline justify-between gap-6 border-b border-border/60 pb-4">
                      <div>
                        <p className="text-base text-foreground">
                          {item.label}
                          {item.show_quantity && item.quantity > 1 ? ` (×${item.quantity})` : ""}
                        </p>
                        {item.client_description && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.client_description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Priced / package */}
            <section>
              <h2 className="font-serif text-2xl text-foreground">
                {data.event.pricing_mode === "flat" ? "Your Package" : "Services"}
              </h2>
              <div className="mt-6 space-y-4">
                {data.event.pricing_mode === "flat" && (
                  <div className="flex items-baseline justify-between gap-6 border-b border-border/60 pb-4">
                    <p className="text-base text-foreground">{data.event.package_name || data.event.title}</p>
                    <p className="whitespace-nowrap font-serif text-lg text-foreground">
                      {money(data.event.package_price_cents)}
                    </p>
                  </div>
                )}
                {priced.map((item) => (
                    <div key={item.id} className="flex items-baseline justify-between gap-6 border-b border-border/60 pb-4">
                      <div>
                        <p className="text-base text-foreground">
                          {item.label}
                          {item.show_quantity && item.quantity > 1 ? ` (×${item.quantity})` : ""}
                        </p>
                        {item.client_description && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.client_description}</p>
                        )}
                      </div>
                      {item.show_price && (
                        <p className="whitespace-nowrap text-base text-foreground">
                          {money(item.quantity * item.unit_price_cents)}
                        </p>
                      )}
                    </div>
                ))}
              </div>
            </section>

            {/* 4. Enhancements */}
            {optional.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-foreground">Enhancements</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select any additional touches you'd like to add to your event.
                  {savingSelections && " Saving…"}
                </p>
                <div className="mt-6 space-y-4">
                  {optional.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start justify-between gap-6 border-b border-border/60 pb-4"
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          disabled={!item.client_selectable}
                          onCheckedChange={(checked) => toggleEnhancement(item, Boolean(checked))}
                          className="mt-1"
                        />
                        <div>
                          <p className="text-base text-foreground">{item.label}</p>
                          {item.client_description && (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {item.client_description}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.show_price && (
                        <p className="whitespace-nowrap text-base text-foreground">
                          {money(item.quantity * item.unit_price_cents)}
                        </p>
                      )}
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* 5. Investment summary */}
            <section className="rounded-sm border border-border bg-card px-6 py-8 sm:px-10">
              <h2 className="font-serif text-2xl text-foreground">Investment Summary</h2>
              <div className="mt-6 space-y-3 text-sm">
                <SummaryRow label="Subtotal" value={money(data.totals.baseCents + data.totals.enhancementsCents)} />
                {data.totals.discountCents > 0 && (
                  <SummaryRow label={data.event.discount_label || "Discount"} value={`−${money(data.totals.discountCents)}`} />
                )}
                {data.totals.serviceChargeCents > 0 && (
                  <SummaryRow
                    label={data.event.service_charge_label || "Service charge"}
                    value={money(data.totals.serviceChargeCents)}
                  />
                )}
                {data.event.tax_enabled && data.totals.taxCents > 0 && (
                  <SummaryRow label="Tax" value={money(data.totals.taxCents)} />
                )}
                {data.totals.processingFeeCents > 0 && (
                  <SummaryRow label="Processing fee" value={money(data.totals.processingFeeCents)} />
                )}
                {data.totals.creditCents > 0 && (
                  <SummaryRow label="Credit applied" value={`−${money(data.totals.creditCents)}`} />
                )}
                <Separator className="my-2" />
                <SummaryRow label="Total" value={money(data.totals.totalCents)} strong />
                <SummaryRow label="Paid to date" value={money(data.amount_paid_cents)} />
                <SummaryRow label="Balance remaining" value={money(data.balance_cents)} strong />
              </div>
            </section>

            {/* 6. Proposal */}
            {proposal && (
              <section className="rounded-sm border border-border px-6 py-8 sm:px-10">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-serif text-2xl text-foreground">Proposal</h2>
                </div>
                {proposal.body && (
                  <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap text-foreground/85">
                    {proposal.body}
                  </div>
                )}
                {proposal.status === "accepted" || proposal.status === "signed" ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-foreground/80">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    Accepted by {proposal.signer_name} on {formatDate(proposal.accepted_at)}
                  </div>
                ) : (
                  <div className="mt-8 space-y-4">
                    <p className="text-sm text-muted-foreground">Type your full name below to accept this proposal.</p>
                    <Input
                      value={acceptName}
                      onChange={(e) => setAcceptName(e.target.value)}
                      placeholder="Full name"
                      className="max-w-sm"
                    />
                    <Button onClick={handleAccept} disabled={!acceptName.trim() || submittingAccept}>
                      {submittingAccept && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Review and accept
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* 7. Contract */}
            {contract && (
              <section className="rounded-sm border border-border px-6 py-8 sm:px-10">
                <div className="flex items-center gap-3">
                  <ScrollText className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-serif text-2xl text-foreground">Contract</h2>
                </div>
                {contract.terms_body && (
                  <div className="prose prose-sm mt-6 max-h-96 max-w-none overflow-y-auto whitespace-pre-wrap rounded-sm border border-border/60 p-4 text-sm leading-relaxed text-foreground/85">
                    {contract.terms_body}
                  </div>
                )}
                {contract.status === "signed" ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-foreground/80">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    Signed by {contract.signer_name} on {formatDate(contract.signed_at)}
                  </div>
                ) : (
                  <div className="mt-8 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Type your full name and signature to sign this contract.
                    </p>
                    <Input
                      value={signName}
                      onChange={(e) => setSignName(e.target.value)}
                      placeholder="Full name"
                      className="max-w-sm"
                    />
                    <Input
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="Type your signature"
                      className="max-w-sm font-serif italic"
                    />
                    <Button onClick={handleSign} disabled={!signName.trim() || !signature.trim() || submittingSign}>
                      {submittingSign && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign contract
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* 8. Payment schedule */}
            {data.invoices.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-foreground">Payment Schedule</h2>
                <div className="mt-6 space-y-6">
                  {data.invoices.map((inv) => {
                    const balance = inv.amount_cents - inv.amount_paid_cents;
                    const isPaid = inv.status === "paid";
                    return (
                      <div key={inv.id} className="border-b border-border/60 pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-base text-foreground">{inv.label || "Payment"}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {inv.due_date ? `Due ${formatDate(inv.due_date)}` : "No due date"} ·{" "}
                              {STATUS_LABEL[inv.status] ?? inv.status}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-serif text-lg text-foreground">{money(inv.amount_cents)}</p>
                            {!isPaid && balance > 0 && (
                              <p className="text-xs text-muted-foreground">Balance {money(balance)}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          {isPaid ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-sm text-accent">
                                <CheckCircle2 className="h-4 w-4" /> Paid {formatDate(inv.paid_at)}
                              </span>
                              <Button variant="outline" size="sm" onClick={() => window.print()}>
                                <Receipt className="mr-2 h-4 w-4" /> Download receipt
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => handlePay(inv.id)} disabled={payingInvoiceId === inv.id}>
                              {payingInvoiceId === inv.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Pay now
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 9. Payment history */}
            {data.payments.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-foreground">Payment History</h2>
                <div className="mt-6 space-y-3">
                  {data.payments.map((p) => (
                    <div key={p.id} className="flex items-baseline justify-between border-b border-border/40 pb-3 text-sm">
                      <span className="text-muted-foreground">
                        {formatDate(p.occurred_at)} · {p.method?.replace(/_/g, " ") || "Payment"}
                      </span>
                      <span className={p.direction === "refund" ? "text-destructive" : "text-foreground"}>
                        {p.direction === "refund" ? "−" : ""}
                        {money(p.amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <footer className="border-t border-border/60 pt-8 text-center">
              <p className="font-serif text-lg tracking-[0.35em] text-foreground">STORM</p>
              <p className="mt-1 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
                Wellness Club
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                18340 Middlebelt Rd, Livonia, MI 48152 &middot; (248) 232-8487
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Questions about your event? We're here for you.
              </p>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${strong ? "font-serif text-lg text-foreground" : "text-foreground/80"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
