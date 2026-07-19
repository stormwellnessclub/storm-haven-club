import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, Ticket, DollarSign, Users, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { EventEmailBlastControls } from "@/components/admin/EventEmailBlastControls";

const CLUB_TZ = "America/Detroit";

export default function EventDetail() {
  const { slug = "" } = useParams();

  const { data: event } = useQuery({
    queryKey: ["admin-event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-event-tickets", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("*")
        .eq("event_id", event!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const paidTickets = tickets.filter((t: any) => t.status === "paid");
  const pendingTickets = tickets.filter((t: any) => t.status === "pending");
  const revenueCents = paidTickets.reduce((sum: number, t: any) => sum + (t.amount_cents || 0), 0);
  const memberCount = paidTickets.filter((t: any) => t.ticket_type === "member").length;
  const nonMemberCount = paidTickets.filter((t: any) => t.ticket_type === "non_member").length;

  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "refunded">("all");
  const filteredTickets = useMemo(
    () => (filter === "all" ? tickets : tickets.filter((t: any) => t.status === filter)),
    [tickets, filter]
  );

  const exportCsv = () => {
    const rows = paidTickets.map((t: any) => ({
      name: `${t.buyer_first_name || ""} ${t.buyer_last_name || ""}`.trim(),
      email: t.buyer_email || "",
      phone: t.buyer_phone || "",
      type: t.ticket_type === "member" ? "Member" : "Non-Member",
      account: t.user_id ? "Portal account" : "Guest checkout",
      amount: `$${((t.amount_cents || 0) / 100).toFixed(2)}`,
      purchased_at: format(new Date(t.created_at), "yyyy-MM-dd HH:mm"),
    }));
    const header = ["Name", "Email", "Phone", "Type", "Account", "Amount", "Purchased"];
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      header.join(","),
      ...rows.map((r) => [r.name, r.email, r.phone, r.type, r.account, r.amount, r.purchased_at].map(escape).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-roster-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/events"><ArrowLeft className="h-4 w-4 mr-1" /> Events</Link>
          </Button>
        </div>

        {event && (
          <>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold">{event.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMM d, yyyy · h:mm a 'ET'")}
                  {event.venue ? ` · ${event.venue}` : ""}
                </p>
              </div>
              <Badge variant={event.status === "on_sale" ? "default" : "secondary"}>{event.status}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Ticket className="h-4 w-4" /> Tickets sold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{paidTickets.length}<span className="text-base text-muted-foreground"> / {event.capacity}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Pending
                  </CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{pendingTickets.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Members
                  </CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{memberCount}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Non-Members
                  </CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{nonMemberCount}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">${(revenueCents / 100).toFixed(2)}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Email announcement</CardTitle>
              </CardHeader>
              <CardContent>
                <EventEmailBlastControls />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                <CardTitle>Roster</CardTitle>
                <div className="flex gap-2 items-center flex-wrap">
                  <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                    <TabsList>
                      <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
                      <TabsTrigger value="paid">Paid ({paidTickets.length})</TabsTrigger>
                      <TabsTrigger value="pending">Pending ({pendingTickets.length})</TabsTrigger>
                      <TabsTrigger value="refunded">Refunded</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" size="sm" onClick={exportCsv} disabled={paidTickets.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer">Public page</a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Purchased</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No tickets yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {tickets.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.buyer_first_name} {t.buyer_last_name}</TableCell>
                        <TableCell className="text-sm">{t.buyer_email}</TableCell>
                        <TableCell>
                          <Badge variant={t.ticket_type === "member" ? "default" : "secondary"}>
                            {t.ticket_type === "member" ? "Member" : "Non-Member"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.status === "paid" ? "default" : t.status === "pending" ? "secondary" : "destructive"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>${(t.amount_cents / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(t.created_at), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
