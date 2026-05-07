import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search, Heart, Mail, Plus, Eye, Send } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { MothersDaySellDialog } from "./MothersDaySellDialog";

const GOAL = 50;

export function MothersDayTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "online" | "in_house">("all");
  const [sellOpen, setSellOpen] = useState(false);
  const [previewVoucherId, setPreviewVoucherId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (voucher_id: string) => {
    setPreviewVoucherId(voucher_id);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-mothers-day-voucher", {
        body: { voucher_id, preview: true },
      });
      if (error) throw error;
      setPreviewData(data);
    } catch (e: any) {
      toast.error(e?.message || "Could not load preview");
      setPreviewVoucherId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ["mothers-day-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mothers_day_vouchers")
        .select("*")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const redeem = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("redeem_mothers_day_voucher", {
        p_code: code,
        p_appointment_id: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Voucher marked as redeemed");
        qc.invalidateQueries({ queryKey: ["mothers-day-vouchers"] });
      } else {
        toast.error(data?.error || "Could not redeem");
      }
    },
  });

  const resend = useMutation({
    mutationFn: async (voucher_id: string) => {
      const { data, error } = await supabase.functions.invoke("send-mothers-day-voucher", {
        body: { voucher_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Voucher email resent"),
    onError: (e: any) => toast.error(e?.message || "Could not resend"),
  });

  const filtered = (vouchers || []).filter((v: any) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (sourceFilter === "online" && v.sold_in_house) return false;
    if (sourceFilter === "in_house" && !v.sold_in_house) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      v.code?.toLowerCase().includes(s) ||
      v.buyer_name?.toLowerCase().includes(s) ||
      v.buyer_email?.toLowerCase().includes(s) ||
      v.recipient_name?.toLowerCase().includes(s) ||
      v.recipient_email?.toLowerCase().includes(s)
    );
  });

  const sold = (vouchers || []).filter((v) => v.status !== "pending" && v.status !== "refunded").length;
  const redeemed = (vouchers || []).filter((v) => v.status === "redeemed").length;
  const active = (vouchers || []).filter((v) => v.status === "active").length;
  const paidVouchers = (vouchers || []).filter((v) => v.status !== "pending" && v.status !== "refunded");
  const revenue = paidVouchers.reduce((s, v) => s + (v.amount_paid_cents || 0), 0);
  const netRevenue = paidVouchers.reduce(
    (s, v: any) => s + ((v.base_amount_cents ?? v.amount_paid_cents) || 0),
    0
  );

  const exportCsv = () => {
    const rows = [
      [
        "Code", "Status", "Sale Source", "Payment Method", "Member?",
        "Buyer First", "Buyer Last", "Buyer Email", "Buyer Phone", "Buyer Gender",
        "Is Gift", "Recipient First", "Recipient Last", "Recipient Email", "Recipient Phone", "Recipient Gender", "Gift Message",
        "Massage", "Duration", "Base", "Processing Fee", "Total Paid", "Admin Notes", "Purchased", "Expires", "Redeemed",
      ],
      ...(vouchers || []).map((v: any) => [
        v.code, v.status,
        v.sold_in_house ? "In-house" : "Online",
        v.payment_method || (v.sold_in_house ? "" : "online"),
        v.buyer_user_id ? "Member" : "Non-member",
        v.buyer_first_name || v.buyer_name || "", v.buyer_last_name || "", v.buyer_email, v.buyer_phone || "", v.buyer_gender || "",
        v.recipient_name ? "Yes" : "No",
        v.recipient_first_name || "", v.recipient_last_name || "", v.recipient_email || "", v.recipient_phone || "", v.recipient_gender || "",
        v.gift_message || "",
        v.massage_choice || "", v.massage_duration,
        ((v.base_amount_cents || 0) / 100).toFixed(2),
        ((v.processing_fee_cents || 0) / 100).toFixed(2),
        ((v.amount_paid_cents || 0) / 100).toFixed(2),
        v.admin_notes || "",
        v.purchased_at, v.expires_at, v.redeemed_at || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mothers-day-vouchers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  if (isLoading)
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Goal tracker */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Mother's Day Goal
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-serif">{sold} / {GOAL}</span>
            <Button size="sm" onClick={() => setSellOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Sell in-house
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(100, (sold / GOAL) * 100)} className="h-3" />
        </CardContent>
      </Card>

      <MothersDaySellDialog open={sellOpen} onOpenChange={setSellOpen} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Sold" value={String(sold)} />
        <Kpi label="Active" value={String(active)} />
        <Kpi label="Redeemed" value={String(redeemed)} />
        <Kpi label="Revenue" value={`$${(revenue / 100).toFixed(0)}`} sub={`Net $${(netRevenue / 100).toFixed(0)}`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search code, name, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {["all", "active", "redeemed", "pending", "expired"].map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["all", "online", "in_house"] as const).map((s) => (
            <Button key={s} size="sm" variant={sourceFilter === s ? "default" : "outline"} onClick={() => setSourceFilter(s)}>
              {s.replace("_", "-")}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No vouchers found.</div>
            )}
            {filtered.map((v: any) => (
              <div key={v.id} className="p-4 flex flex-wrap items-center gap-3 text-sm">
                <div className="font-mono font-semibold tracking-wide">{v.code}</div>
                <Badge variant={v.status === "redeemed" ? "secondary" : v.status === "active" ? "default" : "outline"}>
                  {v.status}
                </Badge>
                <Badge variant={v.buyer_user_id ? "secondary" : "outline"} className="text-xs">
                  {v.buyer_user_id ? "Member" : "Non-member"}
                </Badge>
                {v.sold_in_house && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                    In-house{v.payment_method ? ` · ${v.payment_method.replace(/_/g, " ")}` : ""}
                  </Badge>
                )}
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">
                    {v.recipient_name ? `🎁 ${v.recipient_name}` : v.buyer_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.massage_choice} · {v.massage_duration} min · From {v.buyer_name}
                    {v.buyer_phone ? ` · ${v.buyer_phone}` : ""}
                    {v.buyer_gender ? ` · ${v.buyer_gender.replace(/_/g, " ")}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${((v.amount_paid_cents || 0) / 100).toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">
                    Exp {format(new Date(v.expires_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openPreview(v.id)}
                  title="Preview voucher email"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resend.mutate(v.id)}
                  disabled={resend.isPending}
                  title="Resend voucher email"
                >
                  <Mail className="w-4 h-4" />
                </Button>
                {v.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => redeem.mutate(v.code)} disabled={redeem.isPending}>
                    Mark Redeemed
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!previewVoucherId} onOpenChange={(o) => { if (!o) { setPreviewVoucherId(null); setPreviewData(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewLoading || !previewData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue={previewData.recipient_html ? "recipient" : "buyer"} className="flex-1 overflow-hidden flex flex-col">
              <TabsList>
                {previewData.recipient_html && <TabsTrigger value="recipient">Gift email (recipient)</TabsTrigger>}
                <TabsTrigger value="buyer">Buyer receipt</TabsTrigger>
              </TabsList>
              {previewData.recipient_html && (
                <TabsContent value="recipient" className="flex-1 overflow-auto space-y-2">
                  <div className="text-xs text-muted-foreground">Subject:</div>
                  <div className="font-medium text-sm border rounded px-3 py-2 bg-muted/30">{previewData.recipient_subject}</div>
                  <iframe
                    title="Gift email preview"
                    srcDoc={previewData.recipient_html}
                    className="w-full h-[60vh] border rounded bg-white"
                  />
                </TabsContent>
              )}
              <TabsContent value="buyer" className="flex-1 overflow-auto space-y-2">
                <div className="text-xs text-muted-foreground">Subject:</div>
                <div className="font-medium text-sm border rounded px-3 py-2 bg-muted/30">{previewData.buyer_subject}</div>
                <iframe
                  title="Buyer email preview"
                  srcDoc={previewData.buyer_html}
                  className="w-full h-[60vh] border rounded bg-white"
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-serif mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
