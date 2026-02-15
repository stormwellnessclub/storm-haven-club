import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Gift, XCircle, Send, BarChart3, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, endOfMonth } from "date-fns";
import { toast } from "sonner";

interface CampaignLog {
  id: string;
  sent_by: string;
  credits_allocated: number;
  members_skipped: number;
  members_errored: number;
  sent_at: string;
}

export function GuestPassMarketingTab() {
  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true);
    try {
      const { data, error } = await (supabase
        .from("promo_campaign_log" as any)
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50) as any);
      if (error) throw error;
      setCampaigns((data || []) as CampaignLog[]);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  const stats = useMemo(() => {
    const totalAllocated = campaigns.reduce((s, c) => s + c.credits_allocated, 0);
    const totalSkipped = campaigns.reduce((s, c) => s + c.members_skipped, 0);
    return { totalAllocated, totalSkipped, campaignCount: campaigns.length };
  }, [campaigns]);

  const handleSendPromo = async () => {
    if (!confirm("This will allocate 1 complimentary guest pass credit to every eligible active member. Continue?")) return;

    setIsSending(true);
    try {
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("id, user_id, email, first_name, activated_at, annual_fee_paid_at, annual_fee_subscription_id, subscription_status, billing_type")
        .eq("status", "active");

      if (membersError) throw membersError;
      if (!members || members.length === 0) {
        toast.info("No active members found");
        setIsSending(false);
        return;
      }

      setProgress({ current: 0, total: members.length });

      const now = new Date();
      const monthEnd = endOfMonth(now);
      const expiresAt = new Date(monthEnd);
      expiresAt.setHours(23, 59, 59, 999);
      const cycleStart = format(now, "yyyy-MM-dd");
      const cycleEnd = format(monthEnd, "yyyy-MM-dd");
      const expiryMonth = format(now, "MMMM yyyy");

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const member of members) {
        try {
          if (!member.user_id) { errorCount++; setProgress(prev => ({ ...prev, current: prev.current + 1 })); continue; }

          const isActivated = !!member.activated_at;
          const isInitiationPaid = !!(member.annual_fee_paid_at || member.annual_fee_subscription_id);
          const isDuesCurrent = member.billing_type === 'cash' || ['active', 'trialing'].includes(member.subscription_status || '');

          if (!isActivated || !isInitiationPaid || !isDuesCurrent) {
            skippedCount++;
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            continue;
          }

          const { error: creditError } = await (supabase
            .from("member_credits" as any)
            .insert({
              user_id: member.user_id,
              member_id: member.id,
              credit_type: "guest_pass",
              credits_total: 1,
              credits_remaining: 1,
              cycle_start: cycleStart,
              cycle_end: cycleEnd,
              expires_at: expiresAt.toISOString(),
            }) as any);

          if (creditError) { errorCount++; setProgress(prev => ({ ...prev, current: prev.current + 1 })); continue; }

          if (member.email) {
            await supabase.functions.invoke("send-email", {
              body: { type: "guest_pass_promo", to: member.email, data: { name: member.first_name || "Member", expiryMonth } },
            });
          }

          successCount++;
        } catch { errorCount++; }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      // Log campaign
      await (supabase.from("promo_campaign_log" as any).insert({
        credits_allocated: successCount,
        members_skipped: skippedCount,
        members_errored: errorCount,
      }) as any);

      toast.success(`Promo sent! ${successCount} credits allocated, ${skippedCount} skipped${errorCount > 0 ? `, ${errorCount} errors` : ""}`);
      fetchCampaigns();
    } catch (error: any) {
      toast.error(error?.message || "Failed to send promo");
    } finally {
      setIsSending(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleRevokeCredits = async () => {
    if (!confirm("This will revoke ALL unused complimentary guest pass credits. Continue?")) return;

    setIsRevoking(true);
    try {
      const { data, error } = await (supabase
        .from("member_credits" as any)
        .update({ credits_remaining: 0 })
        .eq("credit_type", "guest_pass")
        .gt("credits_remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .select("id") as any);

      if (error) throw error;
      const count = data?.length || 0;
      toast.success(`${count} credit${count !== 1 ? 's' : ''} revoked`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to revoke credits");
    } finally {
      setIsRevoking(false);
    }
  };

  const isWorking = isSending || isRevoking;

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Send Guest Pass Promo
            </CardTitle>
            <CardDescription>Allocate 1 complimentary credit to every eligible active member</CardDescription>
          </CardHeader>
          <CardContent>
            {isSending && progress.total > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span>{progress.current}/{progress.total}</span>
                <Progress value={(progress.current / progress.total) * 100} className="flex-1 h-2" />
              </div>
            )}
            <Button onClick={handleSendPromo} disabled={isWorking} className="w-full">
              {isSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send Promo to All Members</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Revoke Credits
            </CardTitle>
            <CardDescription>Remove all unused complimentary guest pass credits</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRevokeCredits} disabled={isWorking} variant="destructive" className="w-full">
              {isRevoking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Revoking...</> : <><XCircle className="h-4 w-4 mr-2" />Revoke All Unused Credits</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.campaignCount}</p>
            <p className="text-xs text-muted-foreground">Campaigns Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.totalAllocated}</p>
            <p className="text-xs text-muted-foreground">Total Credits Allocated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.totalSkipped}</p>
            <p className="text-xs text-muted-foreground">Total Skipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingCampaigns ? (
            <div className="text-center py-8"><Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No campaigns sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Credits Allocated</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{format(new Date(c.sent_at), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="text-xs">{c.credits_allocated}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.members_skipped}</TableCell>
                    <TableCell>
                      {c.members_errored > 0 ? (
                        <Badge variant="destructive" className="text-xs">{c.members_errored}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Future Placeholders */}
      <Card variant="flat">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">Email Templates & Outreach Campaigns</p>
          <p className="text-sm">Coming soon — custom email templates and automated outreach sequences</p>
        </CardContent>
      </Card>
    </div>
  );
}
