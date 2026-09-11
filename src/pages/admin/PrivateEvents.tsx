import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  EVENT_STAGES,
  STAGE_TONE,
  computeQuote,
  formatEventDate,
  formatMoney,
} from "@/lib/privateEvents";
import {
  usePrivateEventDetail,
  usePrivateEventMutations,
  usePrivateEventRequests,
  usePrivateEvents,
} from "@/hooks/usePrivateEvents";
import { PrivateEventOverviewTab } from "@/components/admin/private-events/PrivateEventOverviewTab";
import { PrivateEventQuoteTab } from "@/components/admin/private-events/PrivateEventQuoteTab";
import { PrivateEventBillingTab } from "@/components/admin/private-events/PrivateEventBillingTab";
import { PrivateEventTasksTab } from "@/components/admin/private-events/PrivateEventTasksTab";
import { PrivateEventRequestsInbox } from "@/components/admin/private-events/PrivateEventRequestsInbox";
import { PrivateEventsCalendar } from "@/components/admin/private-events/PrivateEventsCalendar";

export default function PrivateEvents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "pipeline";
  const selectedId = searchParams.get("event");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [detailTab, setDetailTab] = useState("overview");

  const { data: events = [], isLoading } = usePrivateEvents();
  const { data: requests = [] } = usePrivateEventRequests();
  const { data: detail } = usePrivateEventDetail(selectedId);
  const { createEvent, deleteEvent } = usePrivateEventMutations();

  const newRequests = requests.filter((r) => r.status === "new").length;

  const setParam = (key: string, value?: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    setSearchParams(p, { replace: true });
  };

  const openEvent = (id: string) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", "pipeline");
    p.set("event", id);
    setSearchParams(p, { replace: true });
    setDetailTab("overview");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (stageFilter !== "all" && e.stage !== stageFilter) return false;
      if (!q) return true;
      return [e.title, e.client_first_name, e.client_last_name, e.client_email, e.event_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [events, search, stageFilter]);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  const paidCents = (detail?.invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_cents, 0);

  const selectedTotals = selected
    ? computeQuote({
        items: (detail?.lineItems ?? []).map((i) => ({
          label: i.label,
          quantity: Number(i.quantity),
          unit_price_cents: i.unit_price_cents,
          taxable: i.taxable,
        })),
        flatTotalCents: selected.flat_total_cents,
        taxEnabled: selected.tax_enabled,
        passProcessingFee: selected.pass_processing_fee,
        depositType: selected.deposit_type,
        depositValue: Number(selected.deposit_value),
        paidCents,
      })
    : null;

  const createBlank = async () => {
    const created = await createEvent.mutateAsync({ title: "New private event", stage: "inquiry" } as any);
    openEvent(created.id);
  };

  return (
    <AdminLayout title="Private Events">
      <Tabs value={tab} onValueChange={(v) => setParam("tab", v)} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {newRequests > 0 && <Badge className="ml-2">{newRequests}</Badge>}
            </TabsTrigger>
          </TabsList>
          <Button onClick={createBlank} disabled={createEvent.isPending}>
            <Plus className="mr-2 h-4 w-4" /> New event
          </Button>
        </div>

        <TabsContent value="pipeline">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {EVENT_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {!isLoading && filtered.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No events here yet.</p>
                )}
                {filtered.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => openEvent(e.id)}
                    className={`w-full rounded-md border p-3 text-left transition hover:bg-muted/50 ${
                      e.id === selectedId ? "border-primary bg-muted/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{e.title}</span>
                      <Badge variant="secondary" className={STAGE_TONE[e.stage] ?? ""}>
                        {EVENT_STAGES.find((s) => s.value === e.stage)?.label ?? e.stage}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatEventDate(e.event_date)}
                      {e.guest_count ? ` · ${e.guest_count} guests` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[e.client_first_name, e.client_last_name].filter(Boolean).join(" ") || "No client yet"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              {!selected && (
                <Card>
                  <CardContent className="py-16 text-center text-sm text-muted-foreground">
                    Choose an event on the left, or start a new one.
                  </CardContent>
                </Card>
              )}

              {selected && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">{selected.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {formatEventDate(selected.event_date)}
                        {selected.start_time ? ` · ${selected.start_time.slice(0, 5)}` : ""}
                        {selectedTotals ? ` · ${formatMoney(selectedTotals.totalCents)} quoted · ${formatMoney(paidCents)} paid` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this event and everything on it?")) {
                          deleteEvent.mutate(selected.id);
                          setParam("event", undefined);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </div>

                  <Tabs value={detailTab} onValueChange={setDetailTab}>
                    <TabsList className="flex-wrap">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="quote">Quote</TabsTrigger>
                      <TabsTrigger value="billing">Billing</TabsTrigger>
                      <TabsTrigger value="tasks">To-do</TabsTrigger>
                      <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4">
                      <PrivateEventOverviewTab event={selected} />
                    </TabsContent>
                    <TabsContent value="quote" className="mt-4">
                      <PrivateEventQuoteTab
                        event={selected}
                        lineItems={detail?.lineItems ?? []}
                        paidCents={paidCents}
                      />
                    </TabsContent>
                    <TabsContent value="billing" className="mt-4">
                      <PrivateEventBillingTab
                        event={selected}
                        invoices={detail?.invoices ?? []}
                        lineItems={detail?.lineItems ?? []}
                      />
                    </TabsContent>
                    <TabsContent value="tasks" className="mt-4">
                      <PrivateEventTasksTab eventId={selected.id} tasks={detail?.tasks ?? []} />
                    </TabsContent>
                    <TabsContent value="timeline" className="mt-4">
                      <Card>
                        <CardContent className="space-y-3 p-4 text-sm">
                          {(detail?.activity ?? []).length === 0 && (
                            <p className="py-6 text-center text-muted-foreground">Nothing logged yet.</p>
                          )}
                          {(detail?.activity ?? []).map((a) => (
                            <div key={a.id} className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
                              <span>{a.message}</span>
                              <span className="whitespace-nowrap text-xs text-muted-foreground">
                                {new Date(a.created_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}
                              </span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <PrivateEventsCalendar events={events} onOpenEvent={openEvent} />
        </TabsContent>

        <TabsContent value="requests">
          <PrivateEventRequestsInbox requests={requests} onOpenEvent={openEvent} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
