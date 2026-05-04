import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Users, X, MessageSquare, AlertTriangle } from "lucide-react";
import { SmsMediaPicker } from "../SmsMediaPicker";
import { estimateCost, segments } from "@/lib/smsCosts";

interface AudienceRecipient {
  email: string;
  name: string;
  user_id?: string | null;
  phone?: string | null;
  sms_opt_in?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipientType: "guest" | "member";
  prefilledRecipient?: { email?: string; name: string; phone?: string | null; user_id?: string | null } | null;
  goalType?: string;
  playbookName?: string;
}

const QUICK_TEMPLATES: Record<string, string> = {
  guest_to_applicant:
    "Storm Wellness Club: Loved your visit? Apply for membership today: stormwellnessclub.com/apply Reply STOP to opt out.",
  re_engage_guest:
    "Storm: We miss you! Come back this week — book a guest pass: stormwellnessclub.com/guest-pass Reply STOP to opt out.",
  collect_feedback:
    "Storm: How was your visit? 30-sec feedback: stormwellnessclub.com/feedback Thanks! Reply STOP to opt out.",
  prevent_churn:
    "Storm: We need an updated card to keep your benefits active: stormwellnessclub.com/portal/billing",
  upsell_tier:
    "Storm: Unlock more — upgrade your tier and save: stormwellnessclub.com/member/membership Reply STOP to opt out.",
  referral_push:
    "Storm: Refer a friend, earn 500 points toward perks: stormwellnessclub.com/member/referrals Reply STOP to opt out.",
};

const COST_GUARDRAIL = 50;

export function ComposeSmsDialog({
  open,
  onOpenChange,
  recipientType,
  prefilledRecipient,
  goalType,
  playbookName,
}: Props) {
  const [campaignName, setCampaignName] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [audience, setAudience] = useState<AudienceRecipient[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCampaignName(playbookName ? `${playbookName} (SMS) — ${new Date().toLocaleDateString()}` : "");
    setBody(goalType ? QUICK_TEMPLATES[goalType] ?? "" : "");
    setMediaUrls([]);
    setRemoved(new Set());
    setProgress({ sent: 0, total: 0 });
    setAudience([]);
    if (prefilledRecipient) {
      setAudience([
        {
          email: prefilledRecipient.email ?? "",
          name: prefilledRecipient.name,
          phone: prefilledRecipient.phone ?? null,
          user_id: prefilledRecipient.user_id ?? null,
          sms_opt_in: true,
        },
      ]);
    } else if (goalType) {
      fetchSmartAudience(goalType);
    }
  }, [open, goalType, prefilledRecipient]);

  const fetchSmartAudience = async (goal: string) => {
    setAudienceLoading(true);
    try {
      // Step 1: emails for segment (reuses email playbook logic)
      let emails: { email: string; name: string }[] = [];

      if (goal === "guest_to_applicant") {
        const [{ data: guests }, { data: apps }] = await Promise.all([
          supabase.from("guest_passes" as any).select("guest_email, guest_name").not("guest_email", "is", null),
          supabase.from("membership_applications").select("email"),
        ]);
        const appEmails = new Set((apps || []).map((a: any) => a.email?.toLowerCase()));
        const seen = new Set<string>();
        (guests || []).forEach((g: any) => {
          const e = g.guest_email?.toLowerCase();
          if (e && !appEmails.has(e) && !seen.has(e)) {
            seen.add(e);
            emails.push({ email: g.guest_email, name: g.guest_name });
          }
        });
      } else if (goal === "re_engage_guest") {
        const thirty = new Date();
        thirty.setDate(thirty.getDate() - 30);
        const { data } = await supabase
          .from("guest_passes" as any)
          .select("guest_email, guest_name, valid_date")
          .not("guest_email", "is", null)
          .lt("valid_date", thirty.toISOString().split("T")[0]);
        const seen = new Set<string>();
        (data || []).forEach((g: any) => {
          const e = g.guest_email?.toLowerCase();
          if (e && !seen.has(e)) {
            seen.add(e);
            emails.push({ email: g.guest_email, name: g.guest_name });
          }
        });
      } else if (goal === "collect_feedback") {
        const [{ data: guests }, { data: fb }] = await Promise.all([
          supabase.from("guest_passes" as any).select("guest_email, guest_name").not("guest_email", "is", null),
          supabase.from("guest_feedback" as any).select("guest_email"),
        ]);
        const fbEmails = new Set((fb || []).map((f: any) => f.guest_email?.toLowerCase()));
        const seen = new Set<string>();
        (guests || []).forEach((g: any) => {
          const e = g.guest_email?.toLowerCase();
          if (e && !fbEmails.has(e) && !seen.has(e)) {
            seen.add(e);
            emails.push({ email: g.guest_email, name: g.guest_name });
          }
        });
      } else if (goal === "prevent_churn") {
        const { data } = await supabase
          .from("members")
          .select("email, first_name, last_name")
          .in("status", ["past_due", "frozen"])
          .not("email", "is", null);
        emails = (data || []).map((m: any) => ({
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
        emails = (data || []).map((m: any) => ({
          email: m.email,
          name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Member",
        }));
      } else if (goal === "referral_push") {
        const [{ data: members }, { data: referrals }] = await Promise.all([
          supabase
            .from("members")
            .select("id, email, first_name, last_name")
            .eq("status", "active")
            .not("email", "is", null)
            .limit(1000),
          supabase.from("member_referrals" as any).select("referring_member_id"),
        ]);
        const referrerIds = new Set((referrals || []).map((r: any) => r.referring_member_id));
        emails = (members || [])
          .filter((m: any) => !referrerIds.has(m.id))
          .map((m: any) => ({
            email: m.email,
            name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Member",
          }));
      }

      // Step 2: Filter to SMS-eligible (sms_opt_in + phone) using profiles lookup
      if (emails.length === 0) {
        setAudience([]);
        return;
      }

      const lowerEmails = emails.map((e) => e.email.toLowerCase());
      // Chunk to avoid URL length limits
      const chunks: string[][] = [];
      for (let i = 0; i < lowerEmails.length; i += 200) chunks.push(lowerEmails.slice(i, i + 200));

      const profileMap = new Map<string, { user_id: string; phone: string | null; sms_opt_in: boolean }>();
      for (const c of chunks) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, email, phone, sms_opt_in")
          .in("email", c);
        (data || []).forEach((p: any) => {
          if (p.email) profileMap.set(p.email.toLowerCase(), p);
        });
      }

      const eligible: AudienceRecipient[] = [];
      emails.forEach((e) => {
        const p = profileMap.get(e.email.toLowerCase());
        if (p?.sms_opt_in && p.phone) {
          eligible.push({
            email: e.email,
            name: e.name,
            user_id: p.user_id,
            phone: p.phone,
            sms_opt_in: true,
          });
        }
      });

      setAudience(eligible);
    } catch (err) {
      console.error("SMS audience error", err);
      toast.error("Failed to load SMS audience");
    }
    setAudienceLoading(false);
  };

  const activeAudience = audience.filter((a) => !removed.has((a.email || a.phone || "").toLowerCase()));
  const segs = segments(body);
  const cost = useMemo(
    () => estimateCost({ recipients: activeAudience.length || 1, body, hasMedia: mediaUrls.length > 0 }),
    [activeAudience.length, body, mediaUrls.length],
  );
  const totalCost = cost.perRecipient * Math.max(1, activeAudience.length);

  const handleClickSend = () => {
    if (!body.trim() && mediaUrls.length === 0) {
      toast.error("Add a message or an image.");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    if (activeAudience.length === 0) {
      toast.error("No SMS-eligible recipients in segment.");
      return;
    }
    setConfirmOpen(true);
  };

  const performSend = async () => {
    setConfirmOpen(false);
    setIsSending(true);
    setProgress({ sent: 0, total: activeAudience.length });

    try {
      const { data: campaign, error: cErr } = await (supabase
        .from("sms_campaigns" as any)
        .insert({
          campaign_name: campaignName.trim(),
          campaign_type: recipientType,
          body,
          media_urls: mediaUrls,
          media_count: mediaUrls.length,
          goal_type: goalType ?? null,
          goal_metadata: goalType ? { attribution_window_days: 14 } : null,
        })
        .select("id")
        .single() as any);
      if (cErr) throw cErr;

      let sent = 0;
      for (const r of activeAudience) {
        const idem = `playbook-sms-${campaign.id}-${r.user_id ?? r.phone}`;
        try {
          const { data, error } = await supabase.functions.invoke("send-sms", {
            body: {
              to: { userId: r.user_id || undefined, phone: r.phone || undefined },
              templateKey: "admin-custom",
              variables: { customBody: body },
              idempotencyKey: idem,
              metadata: { campaign_id: campaign.id, goal_type: goalType, source: "playbook_sms" },
              bypassConsent: false,
              mediaUrls,
            },
          });
          const ok = !error && (data as any)?.success !== false;
          await (supabase.from("sms_campaign_recipients" as any).insert({
            campaign_id: campaign.id,
            recipient_user_id: r.user_id ?? null,
            phone: r.phone ?? null,
            recipient_name: r.name,
            status: ok ? "sent" : ((data as any)?.error || "failed"),
            twilio_sid: (data as any)?.twilio_sid ?? null,
            error_message: error?.message ?? (data as any)?.error ?? null,
            sent_at: ok ? new Date().toISOString() : null,
          }) as any);
          if (ok) sent++;
        } catch (err: any) {
          await (supabase.from("sms_campaign_recipients" as any).insert({
            campaign_id: campaign.id,
            recipient_user_id: r.user_id ?? null,
            phone: r.phone ?? null,
            recipient_name: r.name,
            status: "failed",
            error_message: String(err?.message ?? err),
          }) as any);
        }
        setProgress({ sent: sent, total: activeAudience.length });
        await new Promise((res) => setTimeout(res, 250));
      }

      await (supabase
        .from("sms_campaigns" as any)
        .update({ sent_count: sent, sent_at: new Date().toISOString() })
        .eq("id", campaign.id) as any);

      toast.success(`SMS campaign sent: ${sent} of ${activeAudience.length}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {prefilledRecipient
                ? `Send SMS to ${prefilledRecipient.name}`
                : playbookName
                  ? `${playbookName} — SMS/MMS`
                  : `Compose ${recipientType} SMS`}
            </DialogTitle>
            <DialogDescription>
              Marketing SMS — only opted-in recipients with phone numbers will receive this message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!prefilledRecipient && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">SMS-Eligible Audience</span>
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
                      <Badge
                        key={(r.email || r.phone) ?? r.name}
                        variant="outline"
                        className="text-xs gap-1 pr-1"
                      >
                        {r.name}
                        <button
                          onClick={() =>
                            setRemoved((prev) => new Set([...prev, (r.email || r.phone || "").toLowerCase()]))
                          }
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
                {!audienceLoading && activeAudience.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No recipients in this segment have opted in to SMS with a phone on file.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. February Re-engagement (SMS)"
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={1600}
                placeholder="Type your SMS message…"
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>
                  {body.length} chars · {segs} segment{segs !== 1 ? "s" : ""} · {cost.type}
                </span>
                <span>≈ {cost.perRecipientFormatted}/recipient</span>
              </div>
            </div>

            <SmsMediaPicker value={mediaUrls} onChange={setMediaUrls} />

            <Alert>
              <AlertDescription className="text-xs flex justify-between gap-2">
                <span>
                  Estimated total: <strong>${totalCost.toFixed(2)}</strong> for {activeAudience.length}{" "}
                  recipient{activeAudience.length !== 1 ? "s" : ""}
                </span>
                {totalCost > COST_GUARDRAIL && (
                  <span className="text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Over ${COST_GUARDRAIL}
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {isSending && progress.total > 0 && (
              <div className="text-xs text-muted-foreground">
                Sending… {progress.sent}/{progress.total}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleClickSend} disabled={isSending || activeAudience.length === 0}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Send to {activeAudience.length}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm SMS Campaign</DialogTitle>
            <DialogDescription>
              You're about to send to <strong>{activeAudience.length}</strong> recipients.
              Estimated total cost: <strong>${totalCost.toFixed(2)}</strong>.
              {totalCost > COST_GUARDRAIL && (
                <span className="block mt-2 text-amber-600">
                  ⚠️ This exceeds the ${COST_GUARDRAIL} guardrail. Confirm to proceed.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={performSend}>Send Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
