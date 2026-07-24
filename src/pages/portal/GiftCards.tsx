import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Loader2, Copy, Eye, CalendarClock, Ban, RefreshCw, Sparkles } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";
import { toast } from "sonner";
import { GiftCardPreview } from "@/components/gift-cards/GiftCardPreview";
import { useAuth } from "@/contexts/AuthContext";

const TZ = "America/Detroit";

type CardRow = {
  id: string;
  code: string;
  amount_cents: number;
  balance_cents: number;
  redeemed_cents: number;
  redemption_count: number;
  status: string;
  recipient_name: string;
  recipient_email: string;
  custom_message: string | null;
  scheduled_send_at: string | null;
  email_sent_at: string | null;
  delivered_at: string | null;
  first_redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
  payment_method: string;
  delivery_status: "scheduled" | "sent" | "delivered" | "pending";
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function StatusBadge({ card }: { card: CardRow }) {
  if (card.status === "void") return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
  if (card.balance_cents === 0 && card.amount_cents > 0) return <Badge className="bg-emerald-600 hover:bg-emerald-700">Fully Redeemed</Badge>;
  if (card.redeemed_cents > 0) return <Badge className="bg-amber-600 hover:bg-amber-700">Partially Redeemed</Badge>;
  if (card.delivery_status === "scheduled") return <Badge className="bg-primary/80">Scheduled</Badge>;
  if (card.delivery_status === "delivered") return <Badge className="bg-blue-600 hover:bg-blue-700">Delivered</Badge>;
  if (card.delivery_status === "sent") return <Badge variant="secondary">Sent</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function GiftCards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [previewCard, setPreviewCard] = useState<CardRow | null>(null);
  const [rescheduleCard, setRescheduleCard] = useState<CardRow | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTime, setNewTime] = useState("09:00");

  const { data: cards = [], isLoading, refetch } = useQuery({
    queryKey: ["portal-gift-cards", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_gift_cards");
      if (error) throw error;
      return (data ?? []) as CardRow[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("cancel_scheduled_gift_card", { p_gift_card_id: id });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Could not cancel");
    },
    onSuccess: () => {
      toast.success("Scheduled gift card cancelled");
      qc.invalidateQueries({ queryKey: ["portal-gift-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, when }: { id: string; when: Date }) => {
      const { data, error } = await supabase.rpc("reschedule_gift_card", {
        p_gift_card_id: id,
        p_new_time: when.toISOString(),
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Could not reschedule");
    },
    onSuccess: () => {
      toast.success("Send time updated");
      setRescheduleCard(null);
      qc.invalidateQueries({ queryKey: ["portal-gift-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const gifted = cards.reduce((s, c) => s + (c.status === "void" ? 0 : c.amount_cents), 0);
    const redeemed = cards.reduce((s, c) => s + c.redeemed_cents, 0);
    const outstanding = cards.reduce((s, c) => s + (c.status === "void" ? 0 : c.balance_cents), 0);
    const scheduled = cards.filter((c) => c.delivery_status === "scheduled").length;
    return { gifted, redeemed, outstanding, scheduled };
  }, [cards]);

  const buckets = useMemo(() => ({
    scheduled: cards.filter((c) => c.delivery_status === "scheduled"),
    sent: cards.filter((c) => c.delivery_status === "sent" || c.delivery_status === "delivered"),
    redeemed: cards.filter((c) => c.redeemed_cents > 0),
    all: cards,
  }), [cards]);

  const submitReschedule = () => {
    if (!rescheduleCard || !newDate) return;
    const [h, m] = newTime.split(":").map((n) => parseInt(n, 10));
    const when = new Date(newDate);
    when.setHours(h || 9, m || 0, 0, 0);
    if (when.getTime() <= Date.now()) {
      toast.error("New send time must be in the future");
      return;
    }
    rescheduleMutation.mutate({ id: rescheduleCard.id, when });
  };

  return (
    <PortalLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Gift className="h-6 w-6 text-primary" />
              My Gift Cards
            </h1>
            <p className="text-sm text-muted-foreground">
              Track cards you&apos;ve gifted — delivery status, redemptions, and remaining balance.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total Gifted" value={money(stats.gifted)} icon={<Sparkles className="h-4 w-4" />} />
          <StatCard label="Redeemed" value={money(stats.redeemed)} />
          <StatCard label="Outstanding Balance" value={money(stats.outstanding)} accent />
          <StatCard label="Scheduled" value={String(stats.scheduled)} icon={<CalendarClock className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="all">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All ({buckets.all.length})</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled ({buckets.scheduled.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({buckets.sent.length})</TabsTrigger>
            <TabsTrigger value="redeemed">Redeemed ({buckets.redeemed.length})</TabsTrigger>
          </TabsList>

          {(["all", "scheduled", "sent", "redeemed"] as const).map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
              {isLoading ? (
                <div className="flex justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : buckets[key].length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {buckets[key].map((c) => (
                    <CardListItem
                      key={c.id}
                      card={c}
                      onPreview={() => setPreviewCard(c)}
                      onCancel={() => cancelMutation.mutate(c.id)}
                      onReschedule={() => {
                        setRescheduleCard(c);
                        setNewDate(c.scheduled_send_at ? new Date(c.scheduled_send_at) : new Date());
                        setNewTime(c.scheduled_send_at ? formatInTimeZone(new Date(c.scheduled_send_at), TZ, "HH:mm") : "09:00");
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewCard} onOpenChange={(v) => !v && setPreviewCard(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gift Card Preview</DialogTitle>
            <DialogDescription>
              This is exactly what your recipient will see.
            </DialogDescription>
          </DialogHeader>
          {previewCard && (
            <GiftCardPreview
              amountCents={previewCard.amount_cents}
              recipientName={previewCard.recipient_name}
              senderName="You"
              customMessage={previewCard.custom_message || undefined}
              code={previewCard.code}
              scheduledSendAt={previewCard.scheduled_send_at}
              expiresAt={previewCard.expires_at}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleCard} onOpenChange={(v) => !v && setRescheduleCard(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Delivery</DialogTitle>
            <DialogDescription>
              Update when this gift card email is sent to {rescheduleCard?.recipient_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Send date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    disabled={(d) => d.getTime() < Date.now() - 24 * 60 * 60 * 1000}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Send time (America/Detroit)</Label>
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleCard(null)}>Cancel</Button>
            <Button onClick={submitReschedule} disabled={rescheduleMutation.isPending}>
              {rescheduleMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Update send time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        <Gift className="mx-auto mb-3 h-8 w-8 opacity-40" />
        No gift cards in this view yet.
      </CardContent>
    </Card>
  );
}

function CardListItem({
  card, onPreview, onCancel, onReschedule,
}: {
  card: CardRow;
  onPreview: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const scheduled = card.delivery_status === "scheduled";
  const sendTime = card.scheduled_send_at
    ? formatInTimeZone(new Date(card.scheduled_send_at), TZ, "PPP 'at' p")
    : card.email_sent_at
    ? formatInTimeZone(new Date(card.email_sent_at), TZ, "PPP")
    : formatInTimeZone(new Date(card.created_at), TZ, "PPP");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{card.recipient_name}</span>
            <StatusBadge card={card} />
          </div>
          <div className="truncate text-xs text-muted-foreground">{card.recipient_email}</div>
          <div className="text-xs text-muted-foreground">
            {scheduled ? "Sends " : card.email_sent_at ? "Sent " : "Created "}{sendTime}
            {card.first_redeemed_at && (
              <>
                {" · First redeemed "}
                {formatInTimeZone(new Date(card.first_redeemed_at), TZ, "PPP")}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</div>
            <div className="font-semibold">{money(card.amount_cents)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
            <div className={`font-semibold ${card.balance_cents === 0 ? "text-muted-foreground" : "text-primary"}`}>
              {money(card.balance_cents)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onPreview}>
            <Eye className="mr-1 h-3.5 w-3.5" /> Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(card.code);
              toast.success("Code copied");
            }}
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> Code
          </Button>
          {scheduled && (
            <>
              <Button size="sm" variant="outline" onClick={onReschedule}>
                <CalendarClock className="mr-1 h-3.5 w-3.5" /> Reschedule
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={onCancel}>
                <Ban className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
