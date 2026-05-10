import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";

const ALL_ROLES: AppRole[] = [
  'super_admin', 'admin', 'manager', 'front_desk',
  'spa_staff', 'class_instructor', 'cafe_staff', 'childcare_staff',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function AddPlaceholderStaffDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setSelectedRoles([]);
  };

  const toggleRole = (role: AppRole) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || selectedRoles.length === 0) {
      toast({
        title: "Missing information",
        description: "First name, last name, and at least one role are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('staff_placeholders' as any)
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase() || null,
          phone: phone.trim() || null,
          roles: selectedRoles,
          created_by: user?.id,
        });
      if (error) throw error;
      toast({
        title: "Added to schedule",
        description: `${firstName} ${lastName} can now be scheduled. No invite was sent.`,
      });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      console.error('Error adding placeholder staff:', e);
      toast({ title: "Error", description: e.message ?? "Failed to add staff member", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Schedule</DialogTitle>
          <DialogDescription>
            Add a team member to the schedule without sending an invite email. You can send an invite later when you're ready to give them a login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ph-first">First Name *</Label>
              <Input id="ph-first" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph-last">Last Name *</Label>
              <Input id="ph-last" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ph-email">Email (optional)</Label>
              <Input id="ph-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph-phone">Phone (optional)</Label>
              <Input id="ph-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Role(s) *</Label>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {ALL_ROLES.map((role) => (
                <div key={role} className="flex items-start space-x-3">
                  <Checkbox
                    id={`ph-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label htmlFor={`ph-${role}`} className="font-medium text-sm">
                      {ROLE_LABELS[role]}
                    </Label>
                    <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !firstName.trim() || !lastName.trim() || selectedRoles.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Add to Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
