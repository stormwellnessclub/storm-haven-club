import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Search, UserPlus, Edit2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";

interface StaffMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
}

const ALL_ROLES: AppRole[] = [
  'super_admin',
  'admin',
  'manager',
  'front_desk',
  'spa_staff',
  'class_instructor',
  'cafe_staff',
  'childcare_staff',
];

export default function StaffRoles() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  const fetchStaffMembers = async () => {
    try {
      // Get all users with roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get profiles for these users
      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];
      
      if (userIds.length === 0) {
        setStaffMembers([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const staffMap = new Map<string, StaffMember>();
      
      for (const profile of profilesData || []) {
        staffMap.set(profile.user_id, {
          userId: profile.user_id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          roles: [],
        });
      }

      for (const role of rolesData || []) {
        const staff = staffMap.get(role.user_id);
        if (staff) {
          staff.roles.push(role.role as AppRole);
        }
      }

      setStaffMembers(Array.from(staffMap.values()));
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast({
        title: "Error",
        description: "Failed to load staff members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setEditRoles([...staff.roles]);
    setDialogOpen(true);
  };

  const toggleRole = (role: AppRole) => {
    setEditRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const saveRoles = async () => {
    if (!selectedStaff) return;

    setSaving(true);
    try {
      // Get current roles
      const currentRoles = selectedStaff.roles;
      const newRoles = editRoles;

      // Determine roles to add and remove
      const rolesToAdd = newRoles.filter(r => !currentRoles.includes(r));
      const rolesToRemove = currentRoles.filter(r => !newRoles.includes(r));

      // Remove roles
      if (rolesToRemove.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedStaff.userId)
          .in('role', rolesToRemove);

        if (error) throw error;
      }

      // Add roles
      if (rolesToAdd.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map(role => ({
            user_id: selectedStaff.userId,
            role,
          })));

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Roles updated successfully",
      });

      setDialogOpen(false);
      fetchStaffMembers();
    } catch (error) {
      console.error('Error saving roles:', error);
      toast({
        title: "Error",
        description: "Failed to update roles",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = staffMembers.filter(staff =>
    staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Staff Roles</h1>
            <p className="text-muted-foreground">
              Manage staff access and permissions
            </p>
          </div>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff Member
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search staff by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No staff members found</p>
              <p className="text-sm text-muted-foreground">Add a staff member to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredStaff.map((staff) => (
              <Card key={staff.userId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {staff.firstName} {staff.lastName}
                      </CardTitle>
                      <CardDescription>{staff.email}</CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(staff)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {staff.roles.map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                    {staff.roles.length === 0 && (
                      <span className="text-sm text-muted-foreground">No roles assigned</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Roles Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Roles</DialogTitle>
              <DialogDescription>
                {selectedStaff && `Manage roles for ${selectedStaff.firstName} ${selectedStaff.lastName}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {ALL_ROLES.map((role) => (
                <div key={role} className="flex items-start space-x-3">
                  <Checkbox
                    id={role}
                    checked={editRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label htmlFor={role} className="font-medium">
                      {ROLE_LABELS[role]}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveRoles} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
