import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Search, Eye, EyeOff, Users, Mail } from "lucide-react";

interface PaidMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  referral_code: string | null;
  referral_count: number;
  active_referrals: number;
  points_balance: number;
}

const REFERRAL_BASE_URL = "https://stormwellnessclub.com/apply?ref=";
const CLUB_NAME = "Storm Wellness Club";

export function ReferralCampaignTab() {
  const [members, setMembers] = useState<PaidMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [template, setTemplate] = useState<{ subject: string; body_html: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch template
      const { data: tmpl } = await supabase
        .from("email_templates")
        .select("subject, body_html")
        .eq("name", "Refer a Friend")
        .eq("category", "referral")
        .maybeSingle();
      if (tmpl) setTemplate(tmpl);

      // Fetch active paid members
      const { data: memberData } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, stripe_subscription_id, billing_type")
        .eq("status", "active")
        .not("email", "is", null);

      const paidMembers = (memberData || []).filter(
        (m: any) => m.stripe_subscription_id || m.billing_type === "cash"
      );

      // Fetch referral codes for these members
      const memberIds = paidMembers.map((m: any) => m.id);
      const safeIds = memberIds.length > 0 ? memberIds : ["__none__"];

      const [{ data: codes }, { data: referrals }, { data: pointsData }] = await Promise.all([
        supabase
          .from("referral_codes")
          .select("member_id, code")
          .in("member_id", safeIds),
        supabase
          .from("member_referrals")
          .select("referring_member_id, status")
          .in("referring_member_id", safeIds),
        supabase
          .from("members")
          .select("id, referral_points_balance")
          .in("id", safeIds),
      ]);

      const codeMap = new Map((codes || []).map((c: any) => [c.member_id, c.code]));
      
      // Count referrals per member
      const referralCountMap = new Map<string, number>();
      const activeReferralMap = new Map<string, number>();
      (referrals || []).forEach((r: any) => {
        referralCountMap.set(r.referring_member_id, (referralCountMap.get(r.referring_member_id) || 0) + 1);
        if (r.status === "active") {
          activeReferralMap.set(r.referring_member_id, (activeReferralMap.get(r.referring_member_id) || 0) + 1);
        }
      });

      const pointsMap = new Map((pointsData || []).map((p: any) => [p.id, p.referral_points_balance ?? 0]));

      setMembers(
        paidMembers.map((m: any) => ({
          id: m.id,
          first_name: m.first_name || "",
          last_name: m.last_name || "",
          email: m.email,
          referral_code: codeMap.get(m.id) || null,
          referral_count: referralCountMap.get(m.id) || 0,
          active_referrals: activeReferralMap.get(m.id) || 0,
          points_balance: pointsMap.get(m.id) || 0,
        }))
      );
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const resolveTemplate = (name: string, code: string) => {
    if (!template) return { subject: "", body: "" };
    const link = REFERRAL_BASE_URL + code;
    const resolve = (s: string) =>
      s
        .replace(/\{name\}/g, name)
        .replace(/\{referralCode\}/g, code)
        .replace(/\{referralLink\}/g, link)
        .replace(/\{clubName\}/g, CLUB_NAME);
    return { subject: resolve(template.subject), body: resolve(template.body_html) };
  };

  const sendToMember = async (member: PaidMember) => {
    if (!member.referral_code) {
      toast.error(`${member.first_name} has no referral code`);
      return;
    }
    if (!template) {
      toast.error("Email template not found");
      return;
    }

    setSendingId(member.id);
    try {
      const name = member.first_name;
      const { subject, body } = resolveTemplate(name, member.referral_code);

      // Create campaign
      const { data: campaign, error: campErr } = await (supabase
        .from("email_campaigns" as any)
        .insert({
          campaign_name: `Referral — ${name} ${member.last_name}`,
          campaign_type: "member",
          subject,
          body_html: body,
          sent_count: 1,
          sent_at: new Date().toISOString(),
        })
        .select("id")
        .single() as any);
      if (campErr) throw campErr;

      const { error: sendErr } = await supabase.functions.invoke("send-email", {
        body: {
          type: "staff_reply",
          to: member.email,
          data: { name, subject, content: body },
        },
      });

      await (supabase.from("email_campaign_recipients" as any).insert({
        campaign_id: campaign.id,
        email: member.email,
        recipient_name: `${member.first_name} ${member.last_name}`,
        recipient_type: "member",
        status: sendErr ? "failed" : "sent",
        sent_at: new Date().toISOString(),
      }) as any);

      if (sendErr) throw sendErr;
      toast.success(`Referral email sent to ${name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  const sendToAll = async () => {
    const eligible = members.filter((m) => m.referral_code);
    if (eligible.length === 0) {
      toast.info("No members with referral codes");
      return;
    }
    if (!template) {
      toast.error("Email template not found");
      return;
    }
    if (!confirm(`Send referral email to ${eligible.length} paid active members?`)) return;

    setSendingAll(true);
    try {
      const { data: campaign, error: campErr } = await (supabase
        .from("email_campaigns" as any)
        .insert({
          campaign_name: `Referral Blast — ${new Date().toLocaleDateString()}`,
          campaign_type: "member",
          subject: template.subject,
          body_html: template.body_html,
          sent_count: 0,
        })
        .select("id")
        .single() as any);
      if (campErr) throw campErr;

      let sent = 0;
      for (const member of eligible) {
        try {
          const { subject, body } = resolveTemplate(member.first_name, member.referral_code!);
          await supabase.functions.invoke("send-email", {
            body: {
              type: "staff_reply",
              to: member.email,
              data: { name: member.first_name, subject, content: body },
            },
          });
          await (supabase.from("email_campaign_recipients" as any).insert({
            campaign_id: campaign.id,
            email: member.email,
            recipient_name: `${member.first_name} ${member.last_name}`,
            recipient_type: "member",
            status: "sent",
            sent_at: new Date().toISOString(),
          }) as any);
          sent++;
        } catch {
          await (supabase.from("email_campaign_recipients" as any).insert({
            campaign_id: campaign.id,
            email: member.email,
            recipient_name: `${member.first_name} ${member.last_name}`,
            recipient_type: "member",
            status: "failed",
          }) as any);
        }
      }

      await (supabase
        .from("email_campaigns" as any)
        .update({ sent_count: sent, sent_at: new Date().toISOString() })
        .eq("id", campaign.id) as any);

      toast.success(`Sent to ${sent} of ${eligible.length} members`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk send failed");
    } finally {
      setSendingAll(false);
    }
  };

  const filtered = members.filter(
    (m) =>
      `${m.first_name} ${m.last_name} ${m.email}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const previewHtml = template
    ? template.body_html
        .replace(/\{name\}/g, "Sarah")
        .replace(/\{referralCode\}/g, "STM-REF-SARAH12")
        .replace(/\{referralLink\}/g, REFERRAL_BASE_URL + "STM-REF-SARAH12")
        .replace(/\{clubName\}/g, CLUB_NAME)
    : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Refer-a-Friend Campaign</h2>
          <p className="text-sm text-muted-foreground">
            Send the branded referral email to paid active members
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button size="sm" onClick={sendToAll} disabled={sendingAll}>
            {sendingAll ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-1" />
            )}
            Send to All ({members.filter((m) => m.referral_code).length})
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Referrals</p>
            <p className="text-2xl font-bold">{members.reduce((s, m) => s + m.referral_count, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Converted</p>
            <p className="text-2xl font-bold">{members.reduce((s, m) => s + m.active_referrals, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Members w/ Referrals</p>
            <p className="text-2xl font-bold">{members.filter(m => m.referral_count > 0).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Points Outstanding</p>
            <p className="text-2xl font-bold">{members.reduce((s, m) => s + m.points_balance, 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Email Preview */}
      {showPreview && template && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Preview (sample data)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded-lg overflow-hidden"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Member List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Paid Active Members ({members.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No members found
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span title="Referrals made">{m.referral_count} referral{m.referral_count !== 1 ? "s" : ""}</span>
                    <span title="Converted">{m.active_referrals} converted</span>
                    <span title="Points balance">{m.points_balance} pts</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.referral_code ? (
                      <Badge variant="outline" className="text-xs font-mono">
                        {m.referral_code}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        No code
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!m.referral_code || sendingId === m.id || sendingAll}
                      onClick={() => sendToMember(m)}
                    >
                      {sendingId === m.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
