import { useState, useEffect } from "react";
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
      const { data: codes } = await supabase
        .from("referral_codes")
        .select("member_id, code")
        .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"]);

      const codeMap = new Map((codes || []).map((c: any) => [c.member_id, c.code]));

      setMembers(
        paidMembers.map((m: any) => ({
          id: m.id,
          first_name: m.first_name || "",
          last_name: m.last_name || "",
          email: m.email,
          referral_code: codeMap.get(m.id) || null,
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
              dangerouslySetInnerHTML={{ __html: previewHtml }}
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
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </p>
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
