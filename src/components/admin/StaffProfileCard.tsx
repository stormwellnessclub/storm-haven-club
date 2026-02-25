import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StaffProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt?: string;
}

interface InviteInfo {
  invitedBy?: string;
  invitedByName?: string;
  invitedAt?: string;
  status?: string;
  preAssignedRoles?: string[];
}

interface StaffProfileCardProps {
  profile: StaffProfile;
  inviteInfo: InviteInfo | null;
  isDeactivated: boolean;
  onProfileUpdated: () => void;
}

export function StaffProfileCard({ profile, inviteInfo, isDeactivated, onProfileUpdated }: StaffProfileCardProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          phone: form.phone.trim() || null,
        })
        .eq('user_id', profile.userId);

      if (error) throw error;

      toast({ title: "Profile updated" });
      setEditing(false);
      onProfileUpdated();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Profile Information</CardTitle>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Edit2 className="h-4 w-4 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone || '' }); }}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isDeactivated && (
          <Badge variant="destructive">Deactivated</Badge>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">First Name</Label>
            {editing ? (
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            ) : (
              <p className="text-sm font-medium">{profile.firstName}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Last Name</Label>
            {editing ? (
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            ) : (
              <p className="text-sm font-medium">{profile.lastName}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <p className="text-sm">{profile.email}</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Phone</Label>
          {editing ? (
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
          ) : (
            <p className="text-sm">{profile.phone || '—'}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Account Created</Label>
            <p className="text-sm">{profile.createdAt ? format(new Date(profile.createdAt), 'MMM d, yyyy') : '—'}</p>
          </div>
          {inviteInfo && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Invited By</Label>
              <p className="text-sm">{inviteInfo.invitedByName || '—'}</p>
              {inviteInfo.invitedAt && (
                <p className="text-xs text-muted-foreground">{format(new Date(inviteInfo.invitedAt), 'MMM d, yyyy')}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
