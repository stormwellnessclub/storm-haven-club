import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";

const ALL_ROLES: AppRole[] = [
  'super_admin', 'admin', 'manager', 'front_desk',
  'spa_staff', 'class_instructor', 'cafe_staff', 'childcare_staff',
];

interface InviteStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: () => void;
}

export function InviteStaffDialog({ open, onOpenChange, onInviteSent }: InviteStaffDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [sending, setSending] = useState(false);

  const toggleRole = (role: AppRole) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setSelectedRoles([]);
  };

  const handleSendInvite = async () => {
    if (!email || selectedRoles.length === 0) {
      toast({
        title: "Missing information",
        description: "Please enter an email and select at least one role.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert the invite record
      const { error: insertError } = await supabase
        .from('staff_invites' as any)
        .insert({
          email: email.trim().toLowerCase(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          roles: selectedRoles,
          invited_by: user?.id,
          status: 'pending',
        });

      if (insertError) throw insertError;

      // Build role labels for the email
      const roleLabels = selectedRoles.map(r => ROLE_LABELS[r]).join(', ');

      // Send the invite email
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'staff_invite',
          to: email.trim(),
          data: {
            firstName: firstName.trim() || 'Team Member',
            lastName: lastName.trim() || '',
            roles: roleLabels,
          },
        },
      });

      if (emailError) {
        console.error('Email send error:', emailError);
        // Invite was still created, just email failed
        toast({
          title: "Invite Created",
          description: "The invite was saved but the email could not be sent. The staff member can still create their account.",
        });
      } else {
        toast({
          title: "Invite Sent",
          description: `Invitation sent to ${email} as ${roleLabels}.`,
        });
      }

      resetForm();
      onOpenChange(false);
      onInviteSent();
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: "Error",
        description: "Failed to create staff invite.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Send a branded activation email. The role will be auto-assigned when they create their account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-first">First Name</Label>
              <Input id="invite-first" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-last">Last Name</Label>
              <Input id="invite-last" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address *</Label>
            <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@stormwellnessclub.com" />
          </div>

          <div className="space-y-2">
            <Label>Assign Role(s) *</Label>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {ALL_ROLES.map((role) => (
                <div key={role} className="flex items-start space-x-3">
                  <Checkbox
                    id={`invite-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label htmlFor={`invite-${role}`} className="font-medium text-sm">
                      {ROLE_LABELS[role]}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSendInvite} disabled={sending || !email || selectedRoles.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
