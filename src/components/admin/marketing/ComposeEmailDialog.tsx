import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Eye } from "lucide-react";

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientType: "guest" | "member";
  prefilledRecipient?: { email: string; name: string } | null;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  merge_fields: string[];
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  recipientType,
  prefilledRecipient,
}: ComposeEmailDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setCampaignName("");
      setSubject("");
      setBodyHtml("");
      setSelectedTemplateId("");
      setShowPreview(false);
    }
  }, [open]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("email_templates" as any)
      .select("id, name, subject, body_html, merge_fields")
      .order("name");
    if (data) setTemplates(data as any[]);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    }
  };

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

        // Log campaign
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
          })
          .select("id")
          .single() as any);

        if (campError) throw campError;

        // Send via edge function
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

        // Log recipient
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
        // Bulk send — fetch recipients based on type
        let recipients: { email: string; name: string }[] = [];

        if (recipientType === "guest") {
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

        // Create campaign
        const { data: campaign, error: campError } = await (supabase
          .from("email_campaigns" as any)
          .insert({
            campaign_name: campaignName.trim(),
            campaign_type: recipientType,
            subject: subject,
            body_html: bodyHtml,
            sent_count: 0,
            template_id: selectedTemplateId || null,
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

        // Update campaign sent count
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
              : `Compose ${recipientType === "guest" ? "Guest" : "Member"} Campaign`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label>Body (HTML)</Label>
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
              {prefilledRecipient ? "Send Email" : "Send Campaign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
