import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Copy, MessageSquare, Lock, Info } from "lucide-react";
import {
  SMS_TEMPLATES,
  renderSmsBody,
  smsSegments,
  type SmsTemplate,
} from "@/lib/smsTemplates";
import { toast } from "sonner";

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

export function SmsTemplatesTab() {
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

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
          <strong>Every word that goes out by SMS is listed below.</strong> Bodies
          are code-controlled to protect deliverability and A2P 10DLC compliance —
          they can't be edited from the admin UI. If you want a wording change,
          just say the word and we'll ship it.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> SMS Template Library
          </CardTitle>
          <CardDescription>
            {SMS_TEMPLATES.length} templates · sent automatically based on member
            activity, plus the freeform "Admin custom" used by the Blast tool.
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
              <TemplateRow key={t.key} template={t} />
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

function TemplateRow({ template }: { template: SmsTemplate }) {
  const rendered = renderSmsBody(template.body, template.sampleVariables);
  const segs = smsSegments(rendered);

  const copy = () => {
    navigator.clipboard.writeText(template.body);
    toast.success("Template body copied");
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
            <div className="text-sm font-medium truncate">{template.label}</div>
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
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            Body (raw template)
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
            {template.body}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            Example rendered
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            {rendered}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {rendered.length} chars · {segs} segment{segs !== 1 ? "s" : ""}
            {segs > 1 && " (long — billed as multiple segments)"}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            When it fires
          </div>
          <p className="text-xs">{template.triggers}</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Code-controlled — ping engineering to
            change wording.
          </div>
          <Button size="sm" variant="outline" onClick={copy} className="h-7 text-xs">
            <Copy className="h-3 w-3 mr-1" /> Copy body
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
