import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CANCELLATION_VARIANT_LABELS,
  renderNoticeBody,
  renderNoticeSubject,
  resolveCancellationVariant,
  useCancellationTemplates,
  useSaveCancellationTemplate,
  type CancellationVariant,
} from "@/hooks/useCancellationNotices";

export interface CancellationTarget {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  membership_type?: string | null;
  annual_fee_paid_at?: string | null;
  annual_fee_subscription_id?: string | null;
  stripe_subscription_id?: string | null;
  amountOwed?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: CancellationTarget[];
  onSent?: () => void;
}

export function CancellationNoticeDialog({ open, onOpenChange, targets, onSent }: Props) {
  const { data: templates = [], isLoading } = useCancellationTemplates();
  const saveTemplate = useSaveCancellationTemplate();

  const first = targets[0];
  const autoVariant: CancellationVariant = first ? resolveCancellationVariant(first) : "membership_cancelled";

  const [variant, setVariant] = useState<CancellationVariant>(autoVariant);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [extraMessage, setExtraMessage] = useState("");
  const [includeBalance, setIncludeBalance] = useState(true);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [sending, setSending] = useState(false);

  const template = useMemo(
    () => templates.find(t => t.template_key === variant),
    [templates, variant],
  );

  useEffect(() => {
    if (open) setVariant(autoVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, first?.id]);

  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBody(template.body_html);
    }
  }, [template]);

  const previewVars = {
    name: first?.first_name ?? "there",
    membershipTier: first?.membership_type ? `${first.membership_type} Membership` : "",
    cancellationDate: format(new Date(), "MMMM d, yyyy"),
    amountOwed: includeBalance ? (first?.amountOwed ?? 0) : 0,
    extraMessage,
  };

  const previewHtml = renderNoticeBody(body, previewVars);
  const previewSubject = renderNoticeSubject(subject, previewVars);

  const handleSend = async () => {
    const recipients = targets.filter(t => !!t.email);
    if (recipients.length === 0) {
      toast.error("No recipients with an email address");
      return;
    }
    setSending(true);
    let ok = 0;
    let failed = 0;
    try {
      if (saveAsDefault) {
        await saveTemplate.mutateAsync({ template_key: variant, subject, body_html: body });
      }
      for (const t of recipients) {
        try {
          const { error } = await supabase.functions.invoke("send-email", {
            body: {
              type: variant,
              to: t.email,
              data: {
                name: t.first_name,
                membershipTier: t.membership_type ? `${t.membership_type} Membership` : "",
                cancellationDate: format(new Date(), "MMMM d, yyyy"),
                amountOwed: includeBalance ? (t.amountOwed ?? 0) : 0,
                extraMessage,
                customSubject: subject,
                customBodyHtml: body,
              },
            },
          });
          if (error) throw error;
          await supabase
            .from("members")
            .update({ cancellation_email_sent_at: new Date().toISOString() } as any)
            .eq("id", t.id);
          ok++;
        } catch (e) {
          console.error("Cancellation notice failed for", t.email, e);
          failed++;
        }
      }
      if (ok > 0) toast.success(`Cancellation notice sent to ${ok} member${ok === 1 ? "" : "s"}`);
      if (failed > 0) toast.error(`${failed} notice${failed === 1 ? "" : "s"} failed to send`);
      if (ok > 0) {
        onSent?.();
        onOpenChange(false);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Cancellation Notice
          </DialogTitle>
          <DialogDescription>
            {targets.length === 1 && first
              ? `Preview and edit the notice before it goes to ${first.first_name} ${first.last_name}${first.email ? ` (${first.email})` : ""}.`
              : `Preview and edit the notice before it goes to ${targets.length} members.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Editor */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Notice type</Label>
                <Select value={variant} onValueChange={(v) => setVariant(v as CancellationVariant)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CANCELLATION_VARIANT_LABELS) as CancellationVariant[]).map(k => (
                      <SelectItem key={k} value={k}>{CANCELLATION_VARIANT_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targets.length === 1 && (
                  <p className="text-xs text-muted-foreground">
                    Auto-selected from this member's payment history: {CANCELLATION_VARIANT_LABELS[autoVariant]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Merge fields: {"{{name}}"}, {"{{membershipTier}}"}, {"{{cancellationDate}}"}, {"{{amountOwed}}"},{" "}
                  {"{{amountOwedBlock}}"}, {"{{extraMessage}}"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Add a personal note (optional)</Label>
                <Textarea
                  value={extraMessage}
                  onChange={(e) => setExtraMessage(e.target.value)}
                  rows={3}
                  placeholder="Anything extra you want to add to this send…"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="include-balance" checked={includeBalance} onCheckedChange={(c) => setIncludeBalance(c === true)} />
                <label htmlFor="include-balance" className="text-sm cursor-pointer">
                  Include outstanding balance in the notice
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="save-default" checked={saveAsDefault} onCheckedChange={(c) => setSaveAsDefault(c === true)} />
                <label htmlFor="save-default" className="text-sm cursor-pointer">
                  Save these edits as the default template
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
                <Badge variant="outline" className="text-xs">
                  {targets.length} recipient{targets.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="rounded-lg border bg-background overflow-hidden">
                <div className="border-b bg-muted/40 px-4 py-2 text-xs">
                  <div><span className="text-muted-foreground">Subject: </span><span className="font-medium">{previewSubject}</span></div>
                  {first?.email && (
                    <div><span className="text-muted-foreground">To: </span>{first.email}{targets.length > 1 ? ` +${targets.length - 1} more` : ""}</div>
                  )}
                </div>
                <div
                  className="p-5 text-sm leading-relaxed [&_p]:mb-4 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
              {targets.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Preview shows {first?.first_name}'s copy. Each member receives their own merged version.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || isLoading}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send {targets.length > 1 ? `${targets.length} notices` : "notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
