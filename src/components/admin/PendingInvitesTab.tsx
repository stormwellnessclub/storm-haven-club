import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Copy, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { format } from "date-fns";

interface StaffInvite {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: AppRole[];
  status: string;
  created_at: string;
  claimed_at: string | null;
}

export function PendingInvitesTab() {
  const { toast } = useToast();
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_invites' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = (invite: StaffInvite) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/auth?staff_invite=true&redirect=/admin`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied",
      description: `Activation link copied for ${invite.email}. Share it with them directly.`,
    });
  };

  const resendInvite = async (invite: StaffInvite) => {
    setResendingId(invite.id);
    try {
      const roleLabels = invite.roles.map((r: AppRole) => ROLE_LABELS[r]).join(', ');
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'staff_invite',
          to: invite.email,
          data: {
            firstName: invite.first_name || 'Team Member',
            lastName: invite.last_name || '',
            roles: roleLabels,
          },
        },
      });

      if (error) {
        toast({
          title: "Email Failed",
          description: "Could not send the email. Use 'Copy Link' as a fallback.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Invite Resent",
          description: `Activation email resent to ${invite.email}.`,
        });
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast({
        title: "Error",
        description: "Failed to resend invite. Try copying the link instead.",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const revokeInvite = async (invite: StaffInvite) => {
    try {
      const { error } = await supabase
        .from('staff_invites' as any)
        .update({ status: 'revoked' } as any)
        .eq('id', invite.id);

      if (error) throw error;
      toast({ title: "Invite Revoked", description: `Invite for ${invite.email} has been revoked.` });
      fetchInvites();
    } catch (error) {
      console.error('Revoke error:', error);
      toast({ title: "Error", description: "Failed to revoke invite.", variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'claimed':
        return <Badge variant="secondary">Claimed</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No invites sent yet</p>
          <p className="text-sm text-muted-foreground">Use "Add Staff Member" to send an invite</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell className="font-medium">
                {invite.first_name || ''} {invite.last_name || ''}
                {!invite.first_name && !invite.last_name && <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{invite.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {invite.roles.slice(0, 2).map((role: AppRole) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                  {invite.roles.length > 2 && (
                    <Badge variant="outline" className="text-xs">+{invite.roles.length - 2}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{statusBadge(invite.status)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(invite.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-right">
                {invite.status === 'pending' && (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(invite)}
                      title="Copy activation link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resendInvite(invite)}
                      disabled={resendingId === invite.id}
                      title="Resend email"
                    >
                      {resendingId === invite.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeInvite(invite)}
                      className="text-destructive hover:text-destructive"
                      title="Revoke invite"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
