import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Copy,
  MessageSquare,
  Info,
  Save,
  Send,
  RotateCcw,
  CheckCircle2,
  PencilLine,
  Smartphone,
} from "lucide-react";
import {
  SMS_TEMPLATES,
  renderSmsBody,
  smsSegments,
  type SmsTemplate,
} from "@/lib/smsTemplates";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

const CATEGORIES = [
  "All",
  "Classes",
  "Spa",
  "Kids Care",
  "Cafe",
  "Billing",
  "Admin",
  "System",
] as const;

type OverrideRow = {
  template_key: string;
  draft_body: string | null;
  published_body: string | null;
  draft_updated_at: string | null;
  published_at: string | null;
  version: number;
};

export function SmsTemplatesTab() {
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const { data: overrides = [] } = useQuery({
    queryKey: ["sms-template-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_template_overrides")
        .select(
          "template_key, draft_body, published_body, draft_updated_at, published_at, version",
        );
      if (error) throw error;
      return (data ?? []) as OverrideRow[];
    },
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, OverrideRow>();
    for (const o of overrides) m.set(o.template_key, o);
    return m;
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return SMS_TEMPLATES.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.key.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.triggers.toLowerCase().includes(q)
      );
    });
  }, [filter, category]);

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Inline editing is live.</strong> Edit the wording, preview the
          rendered message, save a draft, then <em>Publish</em> to push the new
          wording to every outgoing SMS. Variables in{" "}
          <code className="font-mono">{`{{curly braces}}`}</code> stay dynamic.
          Use <em>Revert</em> to fall back to the default wording.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> SMS Template Library
          </CardTitle>
          <CardDescription>
            {SMS_TEMPLATES.length} templates · published edits apply to all
            future sends. The freeform "Admin custom" is used by the Blast tool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search templates…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? "default" : "outline"}
                  onClick={() => setCategory(c)}
                  className="h-7 text-xs"
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {filtered.map((t) => (
              <TemplateRow
                key={t.key}
                template={t}
                override={overrideMap.get(t.key) ?? null}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No templates match.
              </p>
            )}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateRow({
  template,
  override,
}: {
  template: SmsTemplate;
  override: OverrideRow | null;
}) {
  const qc = useQueryClient();
  const isAdminCustom = template.key === "admin-custom";

  // Effective live wording = published override || code default
  const liveBody = override?.published_body?.trim()
    ? override.published_body
    : template.body;

  // Working draft state = saved draft, else live
  const initialDraft = override?.draft_body ?? liveBody;
  const [draft, setDraft] = useState<string>(initialDraft);

  useEffect(() => {
    setDraft(override?.draft_body ?? liveBody);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override?.draft_body, override?.published_body]);

  const dirty = draft !== (override?.draft_body ?? liveBody);
  const draftDiffersFromLive = draft.trim() !== liveBody.trim();

  const livePreview = renderSmsBody(liveBody, template.sampleVariables);
  const draftPreview = renderSmsBody(draft, template.sampleVariables);
  const draftSegs = smsSegments(draftPreview);
  const liveSegs = smsSegments(livePreview);

  const upsertOverride = async (patch: Record<string, unknown>) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    const row = {
      template_key: template.key,
      ...patch,
      ...(patch.draft_body !== undefined
        ? { draft_updated_at: new Date().toISOString(), draft_updated_by: userId }
        : {}),
      ...(patch.published_body !== undefined
        ? { published_at: new Date().toISOString(), published_by: userId }
        : {}),
    };
    const { error } = await supabase
      .from("sms_template_overrides")
      .upsert(row, { onConflict: "template_key" });
    if (error) throw error;
    return userId;
  };

  const logHistory = async (
    body: string,
    action: "save_draft" | "publish" | "revert",
    userId: string | null,
  ) => {
    await supabase.from("sms_template_history").insert({
      template_key: template.key,
      body,
      version: (override?.version ?? 0) + 1,
      action,
      changed_by: userId,
    });
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      const userId = await upsertOverride({ draft_body: draft });
      await logHistory(draft, "save_draft", userId);
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["sms-template-overrides"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save draft"),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const userId = await upsertOverride({
        published_body: draft,
        draft_body: draft,
        version: (override?.version ?? 0) + 1,
      });
      await logHistory(draft, "publish", userId);
    },
    onSuccess: () => {
      toast.success("Published — all future sends will use the new wording");
      qc.invalidateQueries({ queryKey: ["sms-template-overrides"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to publish"),
  });

  const revert = useMutation({
    mutationFn: async () => {
      const userId = await upsertOverride({
        published_body: null,
        draft_body: null,
        version: (override?.version ?? 0) + 1,
      });
      await logHistory(template.body, "revert", userId);
    },
    onSuccess: () => {
      toast.success("Reverted to default wording");
      setDraft(template.body);
      qc.invalidateQueries({ queryKey: ["sms-template-overrides"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to revert"),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { data: prof } = await supabase
        .from("profiles")
        .select("phone, sms_opt_in")
        .eq("user_id", userId)
        .maybeSingle();
      if (!prof?.phone) {
        throw new Error(
          "No phone on your admin profile — add one in Member Portal first",
        );
      }
      const testBody = `[TEST] ${draftPreview}`;
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: { userId },
          templateKey: "admin-custom",
          variables: { customBody: testBody },
          idempotencyKey: `tmpl-test-${template.key}-${userId}-${Date.now()}`,
          bypassConsent: true,
          metadata: {
            kind: "template_preview_test",
            template_key: template.key,
          },
        },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error ?? "Send failed");
      }
      return prof.phone as string;
    },
    onSuccess: (phone) => {
      toast.success(`Test SMS sent to ${phone}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send test"),
  });

  const isCustomized = !!override?.published_body?.trim();

  const copy = () => {
    navigator.clipboard.writeText(liveBody);
    toast.success("Live body copied");
  };

  return (
    <AccordionItem
      value={template.key}
      className="border border-border rounded-md px-3 bg-card"
    >
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex flex-1 items-center gap-2 text-left">
          <Badge variant="outline" className="text-[10px] font-mono">
            {template.category}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate flex items-center gap-1.5">
              {template.label}
              {isCustomized && (
                <Badge className="text-[9px] h-4 px-1.5">Customized</Badge>
              )}
              {override?.draft_body &&
                override.draft_body.trim() !==
                  (override.published_body ?? template.body).trim() && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1.5 border-amber-500 text-amber-600"
                  >
                    Draft pending
                  </Badge>
                )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">
              {template.key}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
            {template.audience === "both"
              ? "Members + Non-members"
              : template.audience === "members"
                ? "Members only"
                : "Non-members"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        {isAdminCustom ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              The body for blasts is typed live in the SMS Blast tool — there's
              no template to edit here.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                <PencilLine className="h-3 w-3" /> Edit body
                <span className="text-muted-foreground/70 normal-case font-normal ml-1">
                  · variables: {Object.keys(template.sampleVariables).map((k) => `{{${k}}}`).join(" ")}
                </span>
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Draft preview: {draftPreview.length} chars · {draftSegs} segment
                {draftSegs !== 1 ? "s" : ""}
                {draftSegs > 1 && " (billed as multiple)"}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Live preview (currently sending)
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  {livePreview}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {livePreview.length} chars · {liveSegs} segment
                  {liveSegs !== 1 ? "s" : ""}
                  {isCustomized && override?.published_at && (
                    <>
                      {" "}
                      · published{" "}
                      {formatDistanceToNow(new Date(override.published_at), {
                        addSuffix: true,
                      })}
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Draft preview {draftDiffersFromLive && "(not yet live)"}
                </div>
                <div
                  className={`rounded-md border p-3 text-sm ${
                    draftDiffersFromLive
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  {draftPreview}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Sample vars:{" "}
                  {Object.entries(template.sampleVariables)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(", ")}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                When it fires
              </div>
              <p className="text-xs">{template.triggers}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => sendTest.mutate()}
                disabled={sendTest.isPending}
                className="h-8 text-xs"
                title="Send the draft preview to your admin phone"
              >
                <Smartphone className="h-3 w-3 mr-1" />
                {sendTest.isPending ? "Sending…" : "Send test to my phone"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveDraft.mutate()}
                disabled={!dirty || saveDraft.isPending}
                className="h-8 text-xs"
              >
                <Save className="h-3 w-3 mr-1" /> Save draft
              </Button>
              <Button
                size="sm"
                onClick={() => publish.mutate()}
                disabled={!draftDiffersFromLive || publish.isPending}
                className="h-8 text-xs"
              >
                <Send className="h-3 w-3 mr-1" /> Publish
              </Button>
              {isCustomized && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      confirm(
                        "Revert to default wording? Future sends will use the code default.",
                      )
                    )
                      revert.mutate();
                  }}
                  disabled={revert.isPending}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Revert to default
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraft(liveBody)}
                disabled={!dirty}
                className="h-8 text-xs text-muted-foreground"
              >
                Discard changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copy}
                className="h-8 text-xs text-muted-foreground ml-auto"
              >
                <Copy className="h-3 w-3 mr-1" /> Copy live body
              </Button>
            </div>

            {isCustomized ? (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Live
                wording is the published custom version. Default:{" "}
                <span className="font-mono">{template.body}</span>
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground pt-1">
                Currently using the code default. Edits become live only after
                you click Publish.
              </div>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
