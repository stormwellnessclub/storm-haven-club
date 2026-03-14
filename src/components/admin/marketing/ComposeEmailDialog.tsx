import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Eye, Users, X } from "lucide-react";

interface AudienceRecipient {
  email: string;
  name: string;
}

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientType: "guest" | "member";
  prefilledRecipient?: { email: string; name: string } | null;
  goalType?: string;
  playbookName?: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  merge_fields: string[];
}

// Map goal types to template name keywords for auto-matching
const GOAL_TEMPLATE_MAP: Record<string, string> = {
  guest_to_applicant: "re-engagement",
  re_engage_guest: "re-engagement",
  collect_feedback: "feedback",
  prevent_churn: "announcement",
  upsell_tier: "promo",
  referral_push: "refer",
};

export function ComposeEmailDialog({
  open,
  onOpenChange,
  recipientType,
  prefilledRecipient,
  goalType,
  playbookName,
}: ComposeEmailDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Smart audience
  const [audience, setAudience] = useState<AudienceRecipient[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [removedEmails, setRemovedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setCampaignName(playbookName ? `${playbookName} — ${new Date().toLocaleDateString()}` : "");
      setSubject("");
      setBodyHtml("");
      setSelectedTemplateId("");
      setShowPreview(false);
      setAudience([]);
      setRemovedEmails(new Set());

      if (goalType) {
        fetchSmartAudience(goalType);
      }
    }
  }, [open, goalType]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("email_templates" as any)
      .select("id, name, subject, body_html, merge_fields")
      .order("name");
    if (data) {
      const tpls = data as any[];
      setTemplates(tpls);

      // Auto-select matching template if goalType provided
      if (goalType && GOAL_TEMPLATE_MAP[goalType]) {
        const keyword = GOAL_TEMPLATE_MAP[goalType];
        const match = tpls.find((t) => t.name.toLowerCase().includes(keyword));
        if (match) {
          setSelectedTemplateId(match.id);
          setSubject(match.subject);
          setBodyHtml(match.body_html);
          setShowPreview(true);
        }
      }
    }
  };

  const fetchSmartAudience = async (goal: string) => {
    setAudienceLoading(true);
    try {
      let recipients: AudienceRecipient[] = [];

      if (goal === "guest_to_applicant") {
        const { data: guests } = await supabase
          .from("guest_passes" as any)
          .select("guest_email, guest_name")
          .not("guest_email", "is", null);
        const { data: apps } = await supabase
          .from("membership_applications")
          .select("email");
        const appEmails = new Set((apps || []).map((a: any) => a.email?.toLowerCase()));
        const seen = new Set<string>();
        (guests || []).forEach((g: any) => {
          const email = g.guest_email?.toLowerCase();
          if (email && !appEmails.has(email) && !seen.has(email)) {
            seen.add(email);
            recipients.push({ email: g.guest_email, name: g.guest_name });
          }
        });
      } else if (goal === "re_engage_guest") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data } = await supabase
          .from("guest_passes" as any)
          .select("guest_email, guest_name, valid_date")
          .not("guest_email", "is", null)
          .lt("valid_date", thirtyDaysAgo.toISOString().split("T")[0]);
        const seen = new Set<string>();
        (data || []).forEach((g: any) => {
          const email = g.guest_email?.toLowerCase();
          if (email && !seen.has(email)) {
            seen.add(email);
            recipients.push({ email: g.guest_email, name: g.guest_name });
          }
        });
      } else if (goal === "collect_feedback") {
        const { data: guests } = await supabase
          .from("guest_passes" as any)
          .select("guest_email, guest_name")
          .not("guest_email", "is", null);
        const { data: fb } = await supabase
          .from("guest_feedback" as any)
          .select("guest_email");
        const fbEmails = new Set((fb || []).map((f: any) => f.guest_email?.toLowerCase()));
        const seen = new Set<string>();
        (guests || []).forEach((g: any) => {
          const email = g.guest_email?.toLowerCase();
          if (email && !fbEmails.has(email) && !seen.has(email)) {
            seen.add(email);
            recipients.push({ email: g.guest_email, name: g.guest_name });
          }
        });
      } else if (goal === "prevent_churn") {
        const { data } = await supabase
          .from("members")
          .select("email, first_name, last_name")
          .in("status", ["past_due", "frozen"])
          .not("email", "is", null);
        recipients = (data || []).map((m: any) => ({
          email: m.email,
          name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Member",
        }));
      } else if (goal === "upsell_tier") {
        const { data } = await supabase
          .from("members")
          .select("email, first_name, last_name")
          .eq("status", "active")
          .not("email", "is", null)
          .limit(500);
        recipients = (data || []).map((m: any) => ({
          email: m.email,
          name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Member",
        }));
      } else if (goal === "referral_push") {
        const { data: members } = await supabase
          .from("members")
          .select("id, email, first_name, last_name")
          .eq("status", "active")
          .not("email", "is", null)
          .limit(1000);
        const { data: referrals } = await supabase
          .from("member_referrals" as any)
          .select("referring_member_id");
        const referrerIds = new Set((referrals || []).map((r: any) => r.referring_member_id));
        recipients = (members || [])
          .filter((m: any) => !referrerIds.has(m.id))
          .map((m: any) => ({
            email: m.email,
            name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Member",
          }));
      }

      setAudience(recipients);
    } catch (err) {
      console.error("Error fetching audience:", err);
    }
    setAudienceLoading(false);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    }
  };

  const removeRecipient = (email: string) => {
    setRemovedEmails((prev) => new Set([...prev, email.toLowerCase()]));
  };

  const activeAudience = audience.filter((a) => !removedEmails.has(a.email.toLowerCase()));

  const handleSend = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    setIsSending(true);
    try {
      if (prefilledRecipient) {
        // Single send
        const resolvedSubject = subject.replace(/\{name\}/g, prefilledRecipient.name).replace(/\{clubName\}/g, "Storm Wellness Club");
        const resolvedBody = bodyHtml.replace(/\{name\}/g, prefilledRecipient.name).replace(/\{clubName\}/g, "Storm Wellness Club");

        const { data: campaign, error: campError } = await (supabase
          .from("email_campaigns" as any)
          .insert({
            campaign_name: campaignName.trim(),
            campaign_type: recipientType,
            subject: resolvedSubject,
            body_html: resolvedBody,
            sent_count: 1,
            sent_at: new Date().toISOString(),
            template_id: selectedTemplateId || null,
            goal_type: goalType || null,
            goal_metadata: goalType ? { attribution_window_days: 14 } : null,
          })
          .select("id")
          .single() as any);

        if (campError) throw campError;

        const { error: sendError } = await supabase.functions.invoke("send-email", {
          body: {
            type: "staff_reply",
            to: prefilledRecipient.email,
            data: {
              name: prefilledRecipient.name,
              subject: resolvedSubject,
              content: resolvedBody,
            },
          },
        });

        await (supabase.from("email_campaign_recipients" as any).insert({
          campaign_id: campaign.id,
          email: prefilledRecipient.email,
          recipient_name: prefilledRecipient.name,
          recipient_type: recipientType,
          status: sendError ? "failed" : "sent",
          sent_at: new Date().toISOString(),
        }) as any);

        if (sendError) throw sendError;
        toast.success(`Email sent to ${prefilledRecipient.name}`);
      } else {
        // Bulk send — use smart audience if available, else fallback
        let recipients: AudienceRecipient[] = [];

        if (goalType && activeAudience.length > 0) {
          recipients = activeAudience;
        } else if (recipientType === "guest") {
          const { data } = await supabase
            .from("guest_passes" as any)
            .select("guest_email, guest_name")
            .not("guest_email", "is", null)
            .eq("status", "exhausted");
          const uniqueEmails = new Set<string>();
          recipients = (data || [])
            .filter((g: any) => {
              if (!g.guest_email || uniqueEmails.has(g.guest_email)) return false;
              uniqueEmails.add(g.guest_email);
              return true;
            })
            .map((g: any) => ({ email: g.guest_email, name: g.guest_name }));
        } else {
          const { data } = await supabase
            .from("members")
            .select("email, first_name")
            .eq("status", "active")
            .not("email", "is", null);
          recipients = (data || []).map((m: any) => ({ email: m.email, name: m.first_name || "Member" }));
        }

        if (recipients.length === 0) {
          toast.info("No recipients found");
          setIsSending(false);
          return;
        }

        if (!confirm(`This will send to ${recipients.length} ${recipientType}s. Continue?`)) {
          setIsSending(false);
          return;
        }

        const { data: campaign, error: campError } = await (supabase
          .from("email_campaigns" as any)
          .insert({
            campaign_name: campaignName.trim(),
            campaign_type: recipientType,
            subject: subject,
            body_html: bodyHtml,
            sent_count: 0,
            template_id: selectedTemplateId || null,
            goal_type: goalType || null,
            goal_metadata: goalType ? { attribution_window_days: 14 } : null,
          })
          .select("id")
          .single() as any);

        if (campError) throw campError;

        let sentCount = 0;
        for (const recipient of recipients) {
          try {
            const resolvedSubject = subject.replace(/\{name\}/g, recipient.name).replace(/\{clubName\}/g, "Storm Wellness Club");
            const resolvedBody = bodyHtml.replace(/\{name\}/g, recipient.name).replace(/\{clubName\}/g, "Storm Wellness Club");

            await supabase.functions.invoke("send-email", {
              body: {
                type: "staff_reply",
                to: recipient.email,
                data: { name: recipient.name, subject: resolvedSubject, content: resolvedBody },
              },
            });

            await (supabase.from("email_campaign_recipients" as any).insert({
              campaign_id: campaign.id,
              email: recipient.email,
              recipient_name: recipient.name,
              recipient_type: recipientType,
              status: "sent",
              sent_at: new Date().toISOString(),
            }) as any);

            sentCount++;
          } catch {
            await (supabase.from("email_campaign_recipients" as any).insert({
              campaign_id: campaign.id,
              email: recipient.email,
              recipient_name: recipient.name,
              recipient_type: recipientType,
              status: "failed",
            }) as any);
          }
        }

        await (supabase
          .from("email_campaigns" as any)
          .update({ sent_count: sentCount, sent_at: new Date().toISOString() })
          .eq("id", campaign.id) as any);

        toast.success(`Campaign sent to ${sentCount} of ${recipients.length} ${recipientType}s`);
      }

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const previewHtml = bodyHtml
    .replace(/\{name\}/g, prefilledRecipient?.name || "John")
    .replace(/\{clubName\}/g, "Storm Wellness Club")
    .replace(/\{membershipTier\}/g, "Premium")
    .replace(/\{visitDate\}/g, " on February 15, 2026");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {prefilledRecipient
              ? `Send Email to ${prefilledRecipient.name}`
              : playbookName
                ? `${playbookName} Campaign`
                : `Compose ${recipientType === "guest" ? "Guest" : "Member"} Campaign`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Smart Audience Preview */}
          {goalType && !prefilledRecipient && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Target Audience</span>
                </div>
                {audienceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="secondary">{activeAudience.length} recipients</Badge>
                )}
              </div>
              {!audienceLoading && activeAudience.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {activeAudience.slice(0, 20).map((r) => (
                    <Badge key={r.email} variant="outline" className="text-xs gap-1 pr-1">
                      {r.name}
                      <button
                        onClick={() => removeRecipient(r.email)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {activeAudience.length > 20 && (
                    <Badge variant="outline" className="text-xs">
                      +{activeAudience.length - 20} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. February Re-engagement"
            />
          </div>

          <div className="space-y-2">
            <Label>Use Template (optional)</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Body (HTML)</Label>
              <div className="flex gap-1">
                {["{name}", "{clubName}"].map((field) => (
                  <Badge key={field} variant="outline" className="text-[10px] cursor-pointer hover:bg-muted"
                    onClick={() => setBodyHtml((prev) => prev + field)}>
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
            <Textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<h2>Dear {name},</h2><p>...</p>"
              rows={8}
            />
          </div>

          {showPreview && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Hide Preview" : "Preview"}
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {prefilledRecipient ? "Send Email" : `Send to ${goalType ? activeAudience.length : ""} ${recipientType}s`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
