import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Loader2, Gift, Ticket, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { EditClassPassDialog } from "@/components/admin/EditClassPassDialog";
import { AdminGrantPassDialog } from "@/components/admin/AdminGrantPassDialog";

interface KidsCarePass {
  id: string;
  user_id: string;
  member_id: string | null;
  pass_type: string;
  category: string;
  classes_total: number;
  classes_remaining: number;
  status: string;
  purchased_at: string;
  expires_at: string;
  price_paid: number;
  is_member_price: boolean;
  // joined
  parent_first_name?: string;
  parent_last_name?: string;
  parent_email?: string;
}

export function KidsCarePassesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPass, setEditingPass] = useState<KidsCarePass | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantPrefill, setGrantPrefill] = useState<any>(null);

  const { data: passes, isLoading } = useQuery({
    queryKey: ["admin-kids-care-passes", searchQuery],
    queryFn: async (): Promise<KidsCarePass[]> => {
      if (!user) return [];

      let query = (supabase.from("class_passes") as any)
        .select(`
          id, user_id, member_id, pass_type, category,
          classes_total, classes_remaining, status,
          purchased_at, expires_at, price_paid, is_member_price
        `)
        .or("pass_type.ilike.%kids%,pass_type.ilike.%care%")
        .order("purchased_at", { ascending: false });

      const { data: passData, error } = await query;
      if (error) throw error;
      if (!passData || passData.length === 0) return [];

      // Get parent info for each pass
      const userIds = [...new Set(passData.map((p: any) => p.user_id).filter(Boolean))];
      
      let profileMap: Record<string, any> = {};
      let memberMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", userIds);
        
        (profiles || []).forEach((p: any) => {
          profileMap[p.user_id] = p;
        });

        // Also check members table for member_id lookups
        const memberIds = passData.map((p: any) => p.member_id).filter(Boolean);
        if (memberIds.length > 0) {
          const { data: members } = await supabase
            .from("members")
            .select("id, first_name, last_name, email")
            .in("id", memberIds);
          (members || []).forEach((m: any) => {
            memberMap[m.id] = m;
          });
        }
      }

      return passData.map((p: any) => {
        const profile = profileMap[p.user_id];
        const member = p.member_id ? memberMap[p.member_id] : null;
        return {
          ...p,
          parent_first_name: profile?.first_name || member?.first_name || "",
          parent_last_name: profile?.last_name || member?.last_name || "",
          parent_email: profile?.email || member?.email || "",
        };
      });
    },
    enabled: !!user,
  });

  const filteredPasses = (passes || []).filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.parent_first_name || "").toLowerCase().includes(q) ||
      (p.parent_last_name || "").toLowerCase().includes(q) ||
      (p.parent_email || "").toLowerCase().includes(q)
    );
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/30";
      case "expired": return "bg-muted text-muted-foreground";
      case "exhausted": return "bg-warning/10 text-warning border-warning/30";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by parent name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPasses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No Kids Care passes found</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kids Care Passes</CardTitle>
            <CardDescription>{filteredPasses.length} pass{filteredPasses.length !== 1 ? "es" : ""} found</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Pass Type</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchased</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPasses.map((pass) => (
                  <TableRow key={pass.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {pass.parent_first_name} {pass.parent_last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{pass.parent_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{pass.pass_type.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{pass.classes_remaining}</span>
                      <span className="text-muted-foreground">/{pass.classes_total}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(pass.status)}>
                        {pass.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(pass.purchased_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(pass.expires_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pass.price_paid > 0 ? `$${pass.price_paid}` : "Granted"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPass(pass)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGrantPrefill({
                              userId: pass.user_id,
                              memberId: pass.member_id,
                              name: `${pass.parent_first_name} ${pass.parent_last_name}`.trim(),
                              email: pass.parent_email,
                            });
                            setGrantOpen(true);
                          }}
                        >
                          <Gift className="h-3 w-3 mr-1" />
                          Grant New
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editingPass && (
        <EditClassPassDialog
          open={!!editingPass}
          onOpenChange={(o) => !o && setEditingPass(null)}
          pass={editingPass}
          queryKeysToInvalidate={[["admin-kids-care-passes"], ["admin-kids-care-bookings"]]}
        />
      )}

      <AdminGrantPassDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        prefill={grantPrefill}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-kids-care-passes"] });
        }}
      />
    </div>
  );
}
