import { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Search, Eye, EyeOff, Users, Mail, Megaphone } from "lucide-react";
import { MaintenanceBlastControls } from "@/components/admin/MaintenanceBlastControls";
import { ClosingTonightBlastControls } from "@/components/admin/ClosingTonightBlastControls";
import { PowerOutageBlastControls } from "@/components/admin/PowerOutageBlastControls";

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

const SUBJECT = "Memorial Day Weekend Hours — Storm Wellness Club";

function buildEmailHtml(firstName: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;">
<div style="font-family:Georgia,'Times New Roman',Times,serif;max-width:600px;margin:0 auto;padding:0;">
  <div style="background:#DEDACE;padding:40px 30px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#1C170F;">STORM WELLNESS CLUB</div>
  </div>
  <div style="height:4px;background:linear-gradient(90deg,#B8A068,#C1B19C,#B8A068);"></div>
  <div style="background:#ffffff;padding:30px;border-left:1px solid #C1B19C;border-right:1px solid #C1B19C;font-family:Georgia,serif;">
    <h2 style="color:#1C170F;margin-top:0;font-weight:500;">Dear ${firstName},</h2>
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      As we honor Memorial Day and remember those who served, we wanted to share our adjusted Club hours so you can plan your weekend with ease.
    </p>

    <div style="background:#faf8f3;border:1px solid #C1B19C;border-radius:8px;padding:24px;margin:28px 0;text-align:center;">
      <div style="font-size:12px;letter-spacing:3px;color:#8B7B5C;margin-bottom:14px;">MEMORIAL DAY WEEKEND HOURS</div>
      <div style="font-size:18px;color:#1C170F;margin-bottom:10px;">
        <strong>Sunday, May 24</strong><br/>
        <span style="font-size:16px;color:#374151;">8:00 AM &ndash; 5:00 PM</span>
      </div>
      <div style="height:1px;background:#C1B19C;margin:14px auto;width:60%;"></div>
      <div style="font-size:18px;color:#1C170F;">
        <strong>Monday, May 25 &mdash; Memorial Day</strong><br/>
        <span style="font-size:16px;color:#374151;">7:00 AM &ndash; 5:00 PM</span>
      </div>
    </div>

    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      Regular hours resume <strong>Tuesday, May 26</strong>. All studios, recovery amenities, and the cafe will be open during the hours above.
    </p>
    <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;">
      Wishing you a restful and meaningful weekend.
    </p>

    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="font-style:italic;color:#6b7280;margin-bottom:5px;">Warmly,</p>
      <p style="font-weight:600;color:#1f2937;margin:0;">The Storm Wellness Club Team</p>
    </div>
  </div>
  <div style="height:1px;background:#C1B19C;"></div>
  <div style="background:#1C170F;padding:25px;text-align:center;color:#DEDACE;font-family:Georgia,serif;">
    <p style="color:#B8A068;font-size:14px;margin:0;">Storm Wellness Club</p>
    <p style="color:#DEDACE;font-size:12px;margin:6px 0 0;opacity:0.7;">You're receiving this operational notice as an active member.</p>
  </div>
</div>
</body></html>`;
}

export function AnnouncementsTab() {
  const [members, setMembers] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [includeFrozen, setIncludeFrozen] = useState(true);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, status")
        .in("status", ["active", "frozen"])
        .not("email", "is", null);
      if (error) throw error;
      setMembers((data || []) as Recipient[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const eligible = useMemo(
    () => members.filter((m) => (includeFrozen ? true : m.status === "active") && m.email),
    [members, includeFrozen]
  );

  const filtered = useMemo(
    () =>
      eligible.filter((m) =>
        `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())
      ),
    [eligible, search]
  );

  const previewHtml = buildEmailHtml("Sarah");

  const sendToOne = async (member: Recipient) => {
    setSendingId(member.id);
    try {
      const name = member.first_name || "Member";
      const body = buildEmailHtml(name);
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "staff_reply",
          to: member.email,
          data: { name, subject: SUBJECT, content: body },
        },
      });
      if (error) throw error;
      toast.success(`Sent to ${name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  const sendToAll = async () => {
    if (eligible.length === 0) {
      toast.info("No eligible recipients");
      return;
    }
    if (!confirm(`Send Memorial Day hours email to ${eligible.length} members?`)) return;

    setSendingAll(true);
    setProgress({ sent: 0, total: eligible.length });
    try {
      const { data: campaign, error: campErr } = await (supabase
        .from("email_campaigns" as any)
        .insert({
          campaign_name: `Memorial Day Hours — ${new Date().toLocaleDateString()}`,
          campaign_type: "member",
          subject: SUBJECT,
          body_html: buildEmailHtml("{firstName}"),
          sent_count: 0,
        })
        .select("id")
        .single() as any);
      if (campErr) throw campErr;

      let sent = 0;
      for (const m of eligible) {
        const name = m.first_name || "Member";
        try {
          const body = buildEmailHtml(name);
          await supabase.functions.invoke("send-email", {
            body: {
              type: "staff_reply",
              to: m.email,
              data: { name, subject: SUBJECT, content: body },
            },
          });
          await (supabase.from("email_campaign_recipients" as any).insert({
            campaign_id: campaign.id,
            email: m.email,
            recipient_name: `${m.first_name} ${m.last_name}`.trim(),
            recipient_type: "member",
            status: "sent",
            sent_at: new Date().toISOString(),
          }) as any);
          sent++;
        } catch {
          await (supabase.from("email_campaign_recipients" as any).insert({
            campaign_id: campaign.id,
            email: m.email,
            recipient_name: `${m.first_name} ${m.last_name}`.trim(),
            recipient_type: "member",
            status: "failed",
          }) as any);
        }
        setProgress({ sent: sent, total: eligible.length });
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
      setProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PowerOutageBlastControls />
      <ClosingTonightBlastControls />
      <MaintenanceBlastControls />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Megaphone className="h-5 w-5 mt-1 text-accent" />
          <div>
            <h2 className="text-lg font-semibold">Memorial Day Hours Announcement</h2>
            <p className="text-sm text-muted-foreground">
              Operational notice — Sun 5/24 8AM–5PM &amp; Mon 5/25 7AM–5PM
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button size="sm" onClick={sendToAll} disabled={sendingAll || eligible.length === 0}>
            {sendingAll ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-1" />
            )}
            {sendingAll && progress
              ? `Sending ${progress.sent}/${progress.total}…`
              : `Send to All (${eligible.length})`}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={includeFrozen}
              onCheckedChange={(v) => setIncludeFrozen(!!v)}
            />
            Include frozen members
          </label>
          <div className="text-xs text-muted-foreground">
            Active: {members.filter((m) => m.status === "active").length} &middot; Frozen:{" "}
            {members.filter((m) => m.status === "frozen").length}
          </div>
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Preview (sample: Sarah)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded-lg overflow-hidden bg-white"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Recipients ({filtered.length} of {eligible.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No members found</p>
          ) : (
            <div className="divide-y max-h-[500px] overflow-auto">
              {filtered.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2.5 gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <Badge variant={m.status === "active" ? "outline" : "secondary"} className="text-xs">
                    {m.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sendingId === m.id || sendingAll}
                    onClick={() => sendToOne(m)}
                  >
                    {sendingId === m.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
