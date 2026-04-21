import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, RefreshCcw, User, Loader2 } from "lucide-react";
import { useMembersNotBilled } from "@/hooks/useFailedPaymentsHistory";
import { useSyncMemberStatus } from "@/hooks/usePaymentTracking";
import { toast } from "sonner";

export function MembersNotBilledCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useMembersNotBilled();
  const syncStatus = useSyncMemberStatus();

  const handleSync = async (id: string) => {
    try {
      const r = await syncStatus.mutateAsync(id);
      toast.success(r.synced ? `Status: ${r.currentStatus}` : "Already in sync");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Members Not Being Billed
          {data && (
            <Badge variant={data.length > 0 ? "destructive" : "secondary"} className="ml-2">
              {data.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            All active members appear to be billed correctly.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Last paid</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell><Badge variant="outline">{m.membership_type}</Badge></TableCell>
                  <TableCell className="text-sm">{m.reason}</TableCell>
                  <TableCell className="text-sm">
                    {m.card_brand && m.card_last4 ? `${m.card_brand} •••• ${m.card_last4}` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.last_successful_payment
                      ? new Date(m.last_successful_payment).toLocaleDateString()
                      : <span className="text-muted-foreground">Never</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleSync(m.id)} disabled={syncStatus.isPending}>
                        <RefreshCcw className={`h-3 w-3 ${syncStatus.isPending ? "animate-spin" : ""}`} />
                        <span className="ml-1 hidden sm:inline">Sync</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/members/${m.id}`)}>
                        <User className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
