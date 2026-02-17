import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, BarChart3, Send, Users, TrendingUp } from "lucide-react";

interface Campaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  subject: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

export function CampaignAnalytics() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSent, setTotalSent] = useState(0);
  const [guestConversions, setGuestConversions] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [campaignsRes, recipientsRes] = await Promise.all([
        supabase
          .from("email_campaigns" as any)
          .select("id, campaign_name, campaign_type, subject, sent_count, sent_at, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("email_campaign_recipients" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),
      ]);

      if (campaignsRes.data) setCampaigns(campaignsRes.data as any[]);
      setTotalSent(recipientsRes.count || 0);

      // Guest conversion: guests who became members
      const { count: conversions } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .not("email", "is", null);
      // This is a rough proxy — real conversion tracking would match guest emails to member emails
      setGuestConversions(0); // Placeholder until we build proper tracking
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const guestCampaigns = campaigns.filter((c) => c.campaign_type === "guest").length;
  const memberCampaigns = campaigns.filter((c) => c.campaign_type === "member").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Send className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{campaigns.length}</p>
            <p className="text-xs text-muted-foreground">Total Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalSent}</p>
            <p className="text-xs text-muted-foreground">Emails Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{guestCampaigns}</p>
            <p className="text-xs text-muted-foreground">Guest Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{memberCampaigns}</p>
            <p className="text-xs text-muted-foreground">Member Campaigns</p>
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
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No campaigns sent yet</p>
              <p className="text-sm">Create your first campaign from the Guests or Members tab</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant={c.campaign_type === "guest" ? "secondary" : "default"} className="text-xs">
                        {c.campaign_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{c.subject}</TableCell>
                    <TableCell className="text-sm">{c.sent_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.sent_at ? format(new Date(c.sent_at), "MMM d, yyyy") : "Draft"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
