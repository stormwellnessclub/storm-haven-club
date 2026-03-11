import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Copy } from "lucide-react";
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

  const copyInviteLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/auth?staff_invite=true&redirect=/admin`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied",
      description: "Share this activation link directly with the staff member.",
    });
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
      const { data: { user } } = await supabase.auth.getUser();

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

      const roleLabels = selectedRoles.map(r => ROLE_LABELS[r]).join(', ');

      // Try sending email but don't block on failure
      let emailFailed = false;
      try {
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
          emailFailed = true;
        }
      } catch (e) {
        console.error('Email send exception:', e);
        emailFailed = true;
      }

      if (emailFailed) {
        // Copy link automatically as fallback
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/auth?staff_invite=true&redirect=/admin`;
        await navigator.clipboard.writeText(link);
        toast({
          title: "Invite Created — Email Failed",
          description: "The activation link has been copied to your clipboard. Share it with the staff member directly.",
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={copyInviteLink} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copy Invite Link
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSendInvite} disabled={sending || !email || selectedRoles.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Invite
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
