import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

type StatusFilter = "pending" | "completed" | "expired" | "recovered" | "all";

export default function AbandonedClassPassCheckouts() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["abandoned-cp-checkouts", status],
    queryFn: async () => {
      let q = supabase
        .from("pending_class_pass_checkouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const resend = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-class-pass-abandoned-reminder", {
        body: { pending_id: id, force: true },
      });
      if (error) throw error;
      toast.success("Reminder sent");
      qc.invalidateQueries({ queryKey: ["abandoned-cp-checkouts"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to send reminder");
    }
  };

  const markRecovered = async (id: string) => {
    const { error } = await supabase
      .from("pending_class_pass_checkouts")
      .update({ status: "recovered" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as recovered");
    qc.invalidateQueries({ queryKey: ["abandoned-cp-checkouts"] });
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Abandoned Class Pass Checkouts</h1>
          <p className="text-sm text-muted-foreground">
            Tracks class pass purchases started but not completed. Reminders auto-send at 1h, 24h, and 72h.
          </p>
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="recovered">Recovered</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rows.length} record{rows.length === 1 ? "" : "s"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No checkouts in this status.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-4">Started</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Product</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Reminders</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-4 whitespace-nowrap">{format(new Date(r.created_at), "MMM d, h:mm a")}</td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{r.email}</div>
                          {r.name && <div className="text-xs text-muted-foreground">{r.name}</div>}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="capitalize">{r.product_kind?.replace(/_/g, " ")}</div>
                          {r.pass_type && <div className="text-xs text-muted-foreground">{r.pass_type} · {r.is_member ? "Member" : "Non-member"}</div>}
                        </td>
                        <td className="py-2 pr-4">{r.amount_cents != null ? `$${(r.amount_cents / 100).toFixed(2)}` : "—"}</td>
                        <td className="py-2 pr-4">{r.reminders_sent}/3</td>
                        <td className="py-2 pr-4">
                          <Badge variant={r.status === "completed" ? "default" : r.status === "pending" ? "secondary" : "outline"}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-right space-x-2 whitespace-nowrap">
                          {r.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => resend(r.id)}>
                                <Mail className="h-3.5 w-3.5 mr-1" /> Resend
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => markRecovered(r.id)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Recovered
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
