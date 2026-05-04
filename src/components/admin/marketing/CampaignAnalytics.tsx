import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Loader2, BarChart3, Send, Users, TrendingUp, Target, CheckCircle2 } from "lucide-react";

interface Campaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  subject: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
  goal_type: string | null;
  goal_metadata: any;
  channel: "email" | "sms";
}

interface CampaignWithConversion extends Campaign {
  conversions: number;
  conversionRate: number;
}

const GOAL_LABELS: Record<string, string> = {
  guest_to_applicant: "Guest → Applicant",
  re_engage_guest: "Re-engage Guest",
  collect_feedback: "Collect Feedback",
  prevent_churn: "Prevent Churn",
  upsell_tier: "Upsell Tier",
  referral_push: "Referral Push",
  cafe_first_order: "Cafe: First Sip",
  cafe_winback: "Cafe: Win Back",
  cafe_habit: "Cafe: Habit Builder",
  cafe_drink_of_week: "Cafe: Drink of Week",
};

export function CampaignAnalytics() {
  const [campaigns, setCampaigns] = useState<CampaignWithConversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSent, setTotalSent] = useState(0);
  const [totalSmsSent, setTotalSmsSent] = useState(0);
  const [totalConversions, setTotalConversions] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [campaignsRes, recipientsRes, smsCampaignsRes, smsRecipientsRes] = await Promise.all([
        supabase
          .from("email_campaigns" as any)
          .select("id, campaign_name, campaign_type, subject, sent_count, sent_at, created_at, goal_type, goal_metadata")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("email_campaign_recipients" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),
        supabase
          .from("sms_campaigns" as any)
          .select("id, campaign_name, campaign_type, body, sent_count, sent_at, created_at, goal_type, goal_metadata")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("sms_campaign_recipients" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),
      ]);

      setTotalSent(recipientsRes.count || 0);
      setTotalSmsSent(smsRecipientsRes.count || 0);

      const emailCampaigns = ((campaignsRes.data || []) as any[]).map((c: any) => ({ ...c, channel: "email" as const }));
      const smsCampaigns = ((smsCampaignsRes.data || []) as any[]).map((c: any) => ({
        ...c,
        subject: c.body?.slice(0, 60) ?? "",
        channel: "sms" as const,
      }));
      const rawCampaigns = [...emailCampaigns, ...smsCampaigns].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ) as unknown as Campaign[];

      // Calculate conversions for each campaign with a goal_type
      const withConversions: CampaignWithConversion[] = await Promise.all(
        rawCampaigns.map(async (c) => {
          if (!c.goal_type || !c.sent_at) {
            return { ...c, conversions: 0, conversionRate: 0 };
          }

          const attributionDays = c.goal_metadata?.attribution_window_days || 14;
          const sentDate = c.sent_at;
          const windowEnd = new Date(new Date(sentDate).getTime() + attributionDays * 86400000).toISOString();

          // Skip recipient gate for SMS campaigns; conversions are time-window based
          if (c.channel === "email") {
            const { data: recipientData } = await (supabase
              .from("email_campaign_recipients" as any)
              .select("email")
              .eq("campaign_id", c.id)
              .eq("status", "sent") as any);
            const emails = (recipientData || []).map((r: any) => r.email?.toLowerCase()).filter(Boolean);
            if (emails.length === 0) return { ...c, conversions: 0, conversionRate: 0 };
          } else if (c.sent_count === 0) {
            return { ...c, conversions: 0, conversionRate: 0 };
          }

          let conversions = 0;

          if (c.goal_type === "guest_to_applicant") {
            const { count } = await supabase
              .from("membership_applications")
              .select("id", { count: "exact", head: true })
              .gte("created_at", sentDate)
              .lte("created_at", windowEnd);
            // Cross-check emails would be ideal but we approximate
            conversions = count || 0;
          } else if (c.goal_type === "re_engage_guest") {
            const { count } = await (supabase
              .from("guest_passes" as any)
              .select("id", { count: "exact", head: true })
              .gte("created_at", sentDate)
              .lte("created_at", windowEnd) as any);
            conversions = count || 0;
          } else if (c.goal_type === "collect_feedback") {
            const { count } = await (supabase
              .from("guest_feedback" as any)
              .select("id", { count: "exact", head: true })
              .gte("submitted_at", sentDate)
              .lte("submitted_at", windowEnd) as any);
            conversions = count || 0;
          } else if (c.goal_type === "prevent_churn") {
            // Members who went from frozen/past_due to active in the window
            const { count } = await (supabase
              .from("subscription_status_history" as any)
              .select("id", { count: "exact", head: true })
              .eq("new_status", "active")
              .gte("created_at", sentDate)
              .lte("created_at", windowEnd) as any);
            conversions = count || 0;
          } else if (c.goal_type === "referral_push") {
            const { count } = await (supabase
              .from("member_referrals" as any)
              .select("id", { count: "exact", head: true })
              .gte("created_at", sentDate)
              .lte("created_at", windowEnd) as any);
            conversions = count || 0;
          }

          const rate = c.sent_count > 0 ? Math.round((conversions / c.sent_count) * 100) : 0;
          return { ...c, conversions, conversionRate: rate };
        })
      );

      setCampaigns(withConversions);
      setTotalConversions(withConversions.reduce((sum, c) => sum + c.conversions, 0));
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const goalCampaigns = campaigns.filter((c) => c.goal_type);
  const guestCampaigns = campaigns.filter((c) => c.campaign_type === "guest").length;
  const memberCampaigns = campaigns.filter((c) => c.campaign_type === "member").length;
  const overallConvRate = totalSent > 0 ? ((totalConversions / totalSent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
            <Send className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalSmsSent}</p>
            <p className="text-xs text-muted-foreground">SMS Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{goalCampaigns.length}</p>
            <p className="text-xs text-muted-foreground">Goal-Driven Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
            <p className="text-2xl font-bold">{totalConversions}</p>
            <p className="text-xs text-muted-foreground">Total Conversions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{overallConvRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign History with Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign Performance
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
              <p className="text-sm">Launch your first strategic campaign from the Guests or Members tab</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                 <TableHead>Campaign</TableHead>
                 <TableHead>Channel</TableHead>
                 <TableHead>Type</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Conv. Rate</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant={c.channel === "sms" ? "default" : "outline"} className="text-xs">
                        {c.channel === "sms" ? "SMS/MMS" : "Email"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.campaign_type === "guest" ? "secondary" : "default"} className="text-xs">
                        {c.campaign_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.goal_type ? (
                        <Badge variant="outline" className="text-xs">
                          {GOAL_LABELS[c.goal_type] || c.goal_type}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.sent_count}</TableCell>
                    <TableCell className="text-sm">
                      {c.goal_type ? (
                        <span className={c.conversions > 0 ? "text-emerald-600 font-medium" : ""}>
                          {c.conversions}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.goal_type ? (
                        <span className={c.conversionRate > 10 ? "text-emerald-600 font-medium" : ""}>
                          {c.conversionRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
