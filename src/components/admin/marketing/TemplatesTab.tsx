import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Eye, Pencil, Trash2, FileText } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body_html: string;
  merge_fields: string[];
  is_system: boolean;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  guest_outreach: "Guest Outreach",
  member_promo: "Member Promo",
  feedback_request: "Feedback Request",
  announcement: "Announcement",
  seasonal: "Seasonal",
  referral: "Referral",
};

export function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("announcement");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newMergeFields, setNewMergeFields] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .order("is_system", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as any[]);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newSubject.trim() || !newBody.trim()) {
      toast.error("Please fill in name, subject, and body");
      return;
    }

    setIsCreating(true);
    try {
      const mergeFields = newMergeFields
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const { error } = await (supabase
        .from("email_templates" as any)
        .insert({
          name: newName.trim(),
          category: newCategory,
          subject: newSubject.trim(),
          body_html: newBody.trim(),
          merge_fields: mergeFields,
          is_system: false,
        }) as any);

      if (error) throw error;
      toast.success("Template created");
      setNewName("");
      setNewSubject("");
      setNewBody("");
      setNewMergeFields("");
      fetchTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create template");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (template.is_system) {
      toast.error("System templates cannot be deleted");
      return;
    }
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      const { error } = await (supabase
        .from("email_templates" as any)
        .delete()
        .eq("id", template.id) as any);
      if (error) throw error;
      toast.success("Template deleted");
      fetchTemplates();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Template
          </CardTitle>
          <CardDescription>
            Use merge fields like {"{name}"}, {"{visitDate}"}, {"{membershipTier}"}, {"{clubName}"}, {"{feedbackUrl}"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Summer Special Offer"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. {name}, A Special Offer Awaits"
            />
          </div>
          <div className="space-y-2">
            <Label>Email Body (HTML)</Label>
            <Textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="<h2>Dear {name},</h2><p>Your email content here...</p>"
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label>Merge Fields (comma-separated)</Label>
            <Input
              value={newMergeFields}
              onChange={(e) => setNewMergeFields(e.target.value)}
              placeholder="name, visitDate, membershipTier"
            />
          </div>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Template
          </Button>
        </CardContent>
      </Card>

      {/* Template List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No templates found</p>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{t.name}</p>
                      {t.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Subject: {t.subject}
                    </p>
                    {t.merge_fields?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t.merge_fields.map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px] px-1.5 py-0">
                            {`{${f}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => setPreviewTemplate(t)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{t.name} — Preview</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Subject: {t.subject}</p>
                          <div
                            className="border rounded p-4 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: t.body_html }}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                    {!t.is_system && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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
