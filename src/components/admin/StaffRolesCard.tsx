import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";

const ALL_ROLES: AppRole[] = [
  'super_admin', 'admin', 'manager', 'front_desk',
  'spa_staff', 'class_instructor', 'cafe_staff', 'childcare_staff',
];

interface StaffRolesCardProps {
  userId: string;
  currentRoles: AppRole[];
  onRolesUpdated: () => void;
}

export function StaffRolesCard({ userId, currentRoles, onRolesUpdated }: StaffRolesCardProps) {
  const { toast } = useToast();
  const [editRoles, setEditRoles] = useState<AppRole[]>(currentRoles);
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify([...editRoles].sort()) !== JSON.stringify([...currentRoles].sort());

  const toggleRole = (role: AppRole) => {
    setEditRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const saveRoles = async () => {
    setSaving(true);
    try {
      const rolesToAdd = editRoles.filter(r => !currentRoles.includes(r));
      const rolesToRemove = currentRoles.filter(r => !editRoles.includes(r));

      if (rolesToRemove.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .in('role', rolesToRemove);
        if (error) throw error;
      }

      if (rolesToAdd.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map(role => ({ user_id: userId, role })));
        if (error) throw error;
      }

      toast({ title: "Roles updated" });
      onRolesUpdated();
    } catch (error) {
      console.error('Error saving roles:', error);
      toast({ title: "Error", description: "Failed to update roles", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Roles & Permissions</CardTitle>
        {hasChanges && (
          <Button size="sm" onClick={saveRoles} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ALL_ROLES.map((role) => (
            <div key={role} className="flex items-start space-x-3">
              <Checkbox
                id={`detail-${role}`}
                checked={editRoles.includes(role)}
                onCheckedChange={() => toggleRole(role)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor={`detail-${role}`} className="font-medium text-sm">
                  {ROLE_LABELS[role]}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
