import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldX, Plus, Trash2, Loader2, Search } from "lucide-react";

export default function BlockedPersons() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", full_name: "", reason: "", notes: "" });

  const { data: blocked, isLoading } = useQuery({
    queryKey: ["blocked-persons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_persons")
        .select("*")
        .order("blocked_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("blocked_persons").insert({
        email: form.email.toLowerCase().trim(),
        full_name: form.full_name.trim() || null,
        reason: form.reason.trim() || null,
        notes: form.notes.trim() || null,
        blocked_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Person blocked");
      queryClient.invalidateQueries({ queryKey: ["blocked-persons"] });
      setShowAddDialog(false);
      setForm({ email: "", full_name: "", reason: "", notes: "" });
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error("This email is already blocked");
      } else {
        toast.error("Failed to block: " + err.message);
      }
    },
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_persons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Person unblocked");
      queryClient.invalidateQueries({ queryKey: ["blocked-persons"] });
      setUnblockId(null);
    },
    onError: (err: any) => toast.error("Failed to unblock: " + err.message),
  });

  const filtered = blocked?.filter(
    (b) =>
      !search ||
      b.email?.toLowerCase().includes(search.toLowerCase()) ||
      b.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShieldX className="h-7 w-7 text-destructive" />
              Blocked Persons
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage the universal block list — blocked people cannot access the club, portal, or book services.
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Block Person
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">{filtered?.length ?? 0} blocked</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered && filtered.length > 0 ? (
              <div className="divide-y">
                {filtered.map((person) => (
                  <div key={person.id} className="flex items-start justify-between py-4 gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium">{person.full_name || "—"}</p>
                      <p className="text-sm text-muted-foreground">{person.email}</p>
                      {person.reason && (
                        <p className="text-sm text-destructive/80">{person.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Blocked {format(new Date(person.blocked_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => setUnblockId(person.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldX className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No blocked persons</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Block Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block a Person</DialogTitle>
            <DialogDescription>
              This person will be denied access to the club, portal, and all services.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g., Filed dispute after refund"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional details..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => addBlock.mutate()}
              disabled={!form.email.trim() || addBlock.isPending}
            >
              {addBlock.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Block Person
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Confirmation */}
      <AlertDialog open={!!unblockId} onOpenChange={(open) => !open && setUnblockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock this person?</AlertDialogTitle>
            <AlertDialogDescription>
              They will regain access to the club and portal. This can be reversed by blocking them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unblockId && removeBlock.mutate(unblockId)}>
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
