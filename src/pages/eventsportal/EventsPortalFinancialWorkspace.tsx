import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useFinancialMutations, useFinancialWorkspace } from "@/hooks/useEventFinancials";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { computeFinancials, formatDay, money } from "@/lib/eventFinancials";
import { FinancialEstimateTab } from "@/components/eventsportal/finance/FinancialEstimateTab";
import { FinancialInvoicesTab } from "@/components/eventsportal/finance/FinancialInvoicesTab";
import { FinancialBudgetTab } from "@/components/eventsportal/finance/FinancialBudgetTab";
import { FinancialDocumentsTab } from "@/components/eventsportal/finance/FinancialDocumentsTab";

export default function EventsPortalFinancialWorkspace() {
  const { financialId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useFinancialWorkspace(financialId);
  const { updateFinancial } = useFinancialMutations(financialId);
  const [overrideReason, setOverrideReason] = useState("");

  const totals = useMemo(
    () => (data?.financial ? computeFinancials(data.financial as any, (data.items as any) ?? []) : null),
    [data],
  );

  if (isLoading || !data?.financial) {
    return (
      <EventsPortalShell title="Financials">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <p className="text-sm text-muted-foreground">
            That financial workspace no longer exists.{" "}
            <Link to="/events-portal/finance" className="underline">
              Back to Finance
            </Link>
          </p>
        )}
      </EventsPortalShell>
    );
  }

  const f: any = data.financial;
  const invoices: any[] = data.invoices;
  const paidCents = invoices.reduce((s, i) => s + i.amount_paid_cents, 0);
  const refundedCents = invoices.reduce((s, i) => s + i.amount_refunded_cents, 0);
  const invoicedCents = invoices.filter((i) => i.status !== "void").reduce((s, i) => s + i.amount_cents, 0);
  const eventDate = data.privateEvent?.event_date ?? null;
  const portalUrl = `${window.location.origin}/event-portal/${f.portal_token}`;

  const proposalAccepted = data.documents.some((d: any) => d.kind === "proposal" && d.status === "accepted");
  const contractSigned = data.documents.some((d: any) => d.kind === "contract" && d.status === "signed");
  const depositPaid = invoices.some((i) => i.invoice_type === "deposit" && i.status === "paid");
  const gatesMet =
    (!f.requires_proposal || proposalAccepted) &&
    (!f.requires_contract || contractSigned) &&
    (!f.requires_deposit || depositPaid);

  const override = () => {
    if (!overrideReason.trim()) return toast.error("A reason is required for an override");
    updateFinancial.mutate({
      confirmed_at: new Date().toISOString(),
      gate_override_at: new Date().toISOString(),
      gate_override_reason: overrideReason.trim(),
    });
    setOverrideReason("");
  };

  return (
    <EventsPortalShell
      title={f.title ?? "Event financials"}
      description={`${f.client_name || "Client"}${eventDate ? ` · ${formatDay(eventDate)}` : ""}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {f.legacy_source === "private_events" && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!window.confirm("Roll back this import? The original event, its invoices and payment history stay untouched — only this financial workspace is removed.")) return;
                const { error } = await supabase.rpc("rollback_private_event_financial_import", {
                  p_financial_id: f.id,
                });
                if (error) return toast.error(error.message);
                toast.success("Import rolled back");
                navigate("/events-portal/finance");
              }}
            >
              Roll back import
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href={portalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Client portal
            </a>
          </Button>
        </div>
      }
    >
      {f.is_test && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Internal test event — no automatic reminders are sent for this record.
        </div>
      )}

      {f.needs_review && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Needs review: {f.review_note}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Contracted" value={money(totals?.totalCents ?? 0)} />
        <Stat label="Invoiced" value={money(invoicedCents)} />
        <Stat label="Paid" value={money(paidCents)} />
        <Stat label="Refunded" value={money(refundedCents)} />
        <Stat label="Outstanding" value={money(Math.max(0, invoicedCents - paidCents + refundedCents))} />
        <Stat
          label="Next due"
          value={
            formatDay(
              invoices
                .filter((i) => !["paid", "void", "refunded"].includes(i.status) && i.due_date)
                .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0]?.due_date,
            ) || "—"
          }
        />
      </div>

      <Tabs defaultValue="estimate">
        <TabsList className="flex-wrap">
          <TabsTrigger value="estimate">Estimate</TabsTrigger>
          <TabsTrigger value="invoices">Invoices & schedule</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="budget">Budget & profit</TabsTrigger>
          <TabsTrigger value="confirmation">Confirmation</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="estimate" className="mt-4">
          <FinancialEstimateTab financial={f} items={data.items} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <FinancialInvoicesTab
            financial={f}
            invoices={invoices}
            totalCents={totals?.totalCents ?? 0}
            eventDate={eventDate}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <FinancialDocumentsTab financial={f} documents={data.documents} />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <FinancialBudgetTab
            financial={f}
            budget={data.budget}
            contractedCents={totals?.totalCents ?? 0}
            paidCents={paidCents}
          />
        </TabsContent>

        <TabsContent value="confirmation" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif">What this event requires before it is confirmed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { key: "requires_proposal", label: "Approved proposal", met: proposalAccepted },
                { key: "requires_contract", label: "Signed agreement", met: contractSigned },
                { key: "requires_deposit", label: "Paid deposit", met: depositPaid },
              ].map((g) => (
                <div key={g.key} className="flex items-center justify-between rounded-md border p-3">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={f[g.key]}
                      onCheckedChange={(c) => updateFinancial.mutate({ [g.key]: !!c })}
                    />
                    {g.label}
                  </label>
                  <Badge variant="secondary" className={g.met ? "bg-emerald-100 text-emerald-900" : ""}>
                    {g.met ? "Met" : "Outstanding"}
                  </Badge>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                {f.confirmed_at ? (
                  <span>Confirmed {formatDay(String(f.confirmed_at).slice(0, 10))}</span>
                ) : gatesMet ? (
                  <Button size="sm" onClick={() => updateFinancial.mutate({ confirmed_at: new Date().toISOString() })}>
                    Mark confirmed
                  </Button>
                ) : (
                  <span className="text-muted-foreground">Requirements outstanding.</span>
                )}
              </div>
              {!f.confirmed_at && !gatesMet && (
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Administrative override — reason (recorded with your name and time)</Label>
                  <div className="mt-2 flex gap-2">
                    <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                    <Button variant="outline" onClick={override}>
                      Override
                    </Button>
                  </div>
                </div>
              )}
              {f.gate_override_reason && (
                <p className="text-xs text-muted-foreground">
                  Overridden {formatDay(String(f.gate_override_at).slice(0, 10))}: {f.gate_override_reason}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif">Communications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.communications.length === 0 ? (
                <p className="py-3 text-center text-muted-foreground">Nothing sent yet.</p>
              ) : (
                data.communications.map((c: any) => (
                  <div key={c.id} className="flex flex-wrap justify-between gap-2 border-b py-2 last:border-0">
                    <span>
                      {c.subject} <span className="text-muted-foreground">→ {c.to_email}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="capitalize">
                        {c.status}
                      </Badge>
                      {formatDay(String(c.created_at).slice(0, 10))}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif">Financial activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.activity.length === 0 ? (
                <p className="py-3 text-center text-muted-foreground">No activity recorded yet.</p>
              ) : (
                data.activity.map((a: any) => (
                  <div key={a.id} className="flex justify-between gap-3 border-b py-2 last:border-0">
                    <span>{a.message}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </EventsPortalShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-serif text-lg text-primary">{value}</div>
    </div>
  );
}
