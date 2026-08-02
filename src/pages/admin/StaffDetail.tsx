import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Shield, UserX, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AppRole, ROLE_LABELS } from "@/lib/permissions";
import { StaffProfileCard } from "@/components/admin/StaffProfileCard";
import { StaffRolesCard } from "@/components/admin/StaffRolesCard";
import { StaffActivityLog } from "@/components/admin/StaffActivityLog";
import { StaffPasswordCard } from "@/components/admin/StaffPasswordCard";


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

export default function StaffDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useUserRoles();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isDeactivated = roles.length === 0 && !loading;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  useEffect(() => {
    if (userId) fetchStaffData();
  }, [userId]);

  const fetchStaffData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name, phone, created_at')
        .eq('user_id', userId)
        .single();

      if (profileData) {
        setProfile({
          userId: profileData.user_id,
          email: profileData.email,
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          phone: profileData.phone,
          createdAt: profileData.created_at,
        });
      }

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      setRoles((rolesData || []).map(r => r.role as AppRole));

      // Fetch invite info
      const { data: inviteData } = await supabase
        .from('staff_invites' as any)
        .select('invited_by, created_at, status, roles')
        .eq('email', profileData?.email?.toLowerCase() || '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: any };

      if (inviteData) {
        let inviterName = '—';
        if (inviteData.invited_by) {
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', inviteData.invited_by)
            .single();
          if (inviterProfile) {
            inviterName = `${inviterProfile.first_name} ${inviterProfile.last_name}`.trim();
          }
        }
        setInviteInfo({
          invitedBy: inviteData.invited_by,
          invitedByName: inviterName,
          invitedAt: inviteData.created_at,
          status: inviteData.status,
          preAssignedRoles: inviteData.roles,
        });
      }
    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast({ title: "Error", description: "Failed to load staff profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;

      toast({ title: "Staff member deactivated", description: "All roles have been removed." });
      setDeactivateOpen(false);
      fetchStaffData();
    } catch (error) {
      console.error('Error deactivating:', error);
      toast({ title: "Error", description: "Failed to deactivate staff member", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!userId) return;
    setActionLoading(true);
    try {
      // Re-add a default role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'front_desk' });
      if (error) throw error;

      toast({ title: "Staff member reactivated", description: "Front Desk role assigned. Update roles as needed." });
      fetchStaffData();
    } catch (error) {
      console.error('Error reactivating:', error);
      toast({ title: "Error", description: "Failed to reactivate", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || !profile) return;
    setActionLoading(true);
    try {
      // Delete all roles
      await supabase.from('user_roles').delete().eq('user_id', userId);

      // Delete staff invite records
      await (supabase.from('staff_invites' as any).delete() as any).eq('email', profile.email.toLowerCase());

      toast({ title: "Staff access removed", description: "All roles and invite records deleted." });
      setDeleteOpen(false);
      navigate('/admin/staff-roles');
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: "Error", description: "Failed to remove staff access", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">Staff member not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/staff-roles')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Staff
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/staff-roles')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{fullName || 'Unknown'}</h1>
                {isDeactivated ? (
                  <Badge variant="destructive">Deactivated</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{profile.email}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {roles.map(role => (
                  <Badge key={role} variant="secondary" className="text-xs">{ROLE_LABELS[role]}</Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isDeactivated ? (
              <Button variant="outline" onClick={handleReactivate} disabled={actionLoading}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reactivate
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setDeactivateOpen(true)}>
                <UserX className="h-4 w-4 mr-2" /> Deactivate
              </Button>
            )}
            {isSuperAdmin() && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Content grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <StaffProfileCard
              profile={profile}
              inviteInfo={inviteInfo}
              isDeactivated={isDeactivated}
              onProfileUpdated={fetchStaffData}
            />
            <StaffRolesCard
              userId={profile.userId}
              currentRoles={roles}
              onRolesUpdated={fetchStaffData}
            />
            <StaffPasswordCard userId={profile.userId} email={profile.email} />

          </div>
          <StaffActivityLog userId={profile.userId} />
        </div>

        {/* Deactivate Dialog */}
        <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate Staff Member</DialogTitle>
              <DialogDescription>
                This will remove all roles for {fullName}. They will lose access to all admin pages. Activity history is preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeactivate} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Staff Access</DialogTitle>
              <DialogDescription>
                This permanently removes all roles and invite records for {fullName}. Type their full name to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Type "{fullName}" to confirm</Label>
              <Input
                className="mt-2"
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={fullName}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirmName(''); }}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={actionLoading || deleteConfirmName !== fullName}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete Staff Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
