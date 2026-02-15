import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, UserPlus, MessageSquare, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

interface FollowUpGuest {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number: string | null;
  valid_date: string | null;
  used_at: string | null;
  member_referral: string | null;
  follow_up_status: string | null;
  follow_up_notes: string | null;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", variant: "default" as const },
  { value: "contacted", label: "Contacted", variant: "secondary" as const },
  { value: "interested", label: "Interested", variant: "default" as const },
  { value: "not_interested", label: "Not Interested", variant: "outline" as const },
  { value: "converted", label: "Converted", variant: "default" as const },
];

export function GuestPassFollowUpTab() {
  const [guests, setGuests] = useState<FollowUpGuest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notesDialog, setNotesDialog] = useState<FollowUpGuest | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const fetchFollowUps = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from("guest_passes" as any)
        .select("id, guest_name, guest_email, phone_number, valid_date, used_at, member_referral, follow_up_status, follow_up_notes")
        .or("status.eq.exhausted,used_at.not.is.null")
        .order("used_at", { ascending: false })
        .limit(500) as any);

      if (error) throw error;
      setGuests((data || []) as FollowUpGuest[]);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      toast.error("Failed to load follow-up queue");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (guestId: string, newStatus: string) => {
    try {
      const { error } = await (supabase
        .from("guest_passes" as any)
        .update({ follow_up_status: newStatus })
        .eq("id", guestId) as any);
      if (error) throw error;
      setGuests(prev => prev.map(g => g.id === guestId ? { ...g, follow_up_status: newStatus } : g));
      toast.success("Status updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update status");
    }
  };

  const saveNotes = async () => {
    if (!notesDialog) return;
    try {
      const { error } = await (supabase
        .from("guest_passes" as any)
        .update({ follow_up_notes: noteText })
        .eq("id", notesDialog.id) as any);
      if (error) throw error;
      setGuests(prev => prev.map(g => g.id === notesDialog.id ? { ...g, follow_up_notes: noteText } : g));
      setNotesDialog(null);
      toast.success("Notes saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save notes");
    }
  };

  const filtered = useMemo(() => {
    let list = guests;
    if (statusFilter !== "all") {
      list = list.filter(g => (g.follow_up_status || "new") === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(g =>
        g.guest_name.toLowerCase().includes(q) ||
        g.guest_email?.toLowerCase().includes(q) ||
        g.phone_number?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [guests, statusFilter, searchQuery]);

  const getStatusBadge = (status: string | null) => {
    const s = STATUS_OPTIONS.find(o => o.value === (status || "new"));
    if (!s) return <Badge variant="outline" className="text-xs">New</Badge>;
    return (
      <Badge
        variant={s.variant}
        className={`text-xs ${s.value === 'converted' ? 'bg-green-600' : s.value === 'interested' ? 'bg-blue-600' : ''}`}
      >
        {s.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guest name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map(o => {
          const count = guests.filter(g => (g.follow_up_status || "new") === o.value).length;
          return (
            <Card key={o.value} className="cursor-pointer" onClick={() => setStatusFilter(o.value)}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{o.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No guests in follow-up queue</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead className="hidden sm:table-cell">Visit Date</TableHead>
                  <TableHead className="hidden md:table-cell">Days Since</TableHead>
                  <TableHead className="hidden md:table-cell">Referral</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => {
                  const visitDate = g.used_at || g.valid_date;
                  const daysSince = visitDate ? differenceInDays(new Date(), new Date(visitDate)) : null;
                  return (
                    <TableRow key={g.id}>
                      <TableCell>
                        <div className="font-medium">{g.guest_name}</div>
                        <div className="text-xs text-muted-foreground">{g.guest_email || g.phone_number || "—"}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {visitDate ? format(new Date(visitDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {daysSince !== null ? `${daysSince}d ago` : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {g.member_referral || "—"}
                      </TableCell>
                      <TableCell>
                        <Select value={g.follow_up_status || "new"} onValueChange={(v) => updateStatus(g.id, v)}>
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setNoteText(g.follow_up_notes || "");
                            setNotesDialog(g);
                          }}
                          title="Add notes"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={!!notesDialog} onOpenChange={(open) => !open && setNotesDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow-Up Notes — {notesDialog?.guest_name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add follow-up notes..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog(null)}>Cancel</Button>
            <Button onClick={saveNotes}>Save Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
