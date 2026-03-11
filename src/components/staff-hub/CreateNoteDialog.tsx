import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const ROLES = Object.entries(ROLE_LABELS) as [AppRole, string][];

export function CreateNoteDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("all_staff");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: AppRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);

    const { error } = await supabase.from("staff_notes").insert({
      title: title.trim(),
      content: content.trim(),
      created_by: user.id,
      visibility,
      visible_to_roles: visibility === "specific_roles" ? selectedRoles : [],
    });

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Note created" });
      setTitle("");
      setContent("");
      setVisibility("all_staff");
      setSelectedRoles([]);
      onOpenChange(false);
      onCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title" />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your note..." rows={5} />
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_staff">All Staff</SelectItem>
                <SelectItem value="specific_roles">Specific Roles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {visibility === "specific_roles" && (
            <div className="flex flex-wrap gap-2">
              {ROLES.map(([role, label]) => (
                <Button
                  key={role}
                  type="button"
                  variant={selectedRoles.includes(role) ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => toggleRole(role)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          <Button onClick={handleSubmit} disabled={saving || !title.trim()} className="w-full">
            {saving ? "Creating..." : "Create Note"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
