import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Search, UserPlus, Mail, Loader2, Archive, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole, ROLE_LABELS } from "@/lib/permissions";
import { InviteStaffDialog } from "@/components/admin/InviteStaffDialog";
import { AddPlaceholderStaffDialog } from "@/components/admin/AddPlaceholderStaffDialog";
import { PendingInvitesTab } from "@/components/admin/PendingInvitesTab";
import { FrontDeskLoginCard } from "@/components/admin/FrontDeskLoginCard";
import { format } from "date-fns";

interface StaffMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
  createdAt?: string;
}

interface Placeholder {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roles: AppRole[];
  createdAt: string;
}

export default function StaffRoles() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);

  useEffect(() => {
    fetchStaffMembers();
    fetchPlaceholders();
  }, []);

  const fetchPlaceholders = async () => {
    const { data, error } = await (supabase as any)
      .from('staff_placeholders')
      .select('id, first_name, last_name, email, phone, roles, created_at')
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching placeholders:', error);
      return;
    }
    setPlaceholders((data ?? []).map((p: any) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
      phone: p.phone,
      roles: p.roles ?? [],
      createdAt: p.created_at,
    })));
  };

  const archivePlaceholder = async (id: string) => {
    const { error } = await (supabase as any)
      .from('staff_placeholders')
      .update({ archived: true })
      .eq('id', id);
    if (error) {
      toast({ title: "Error", description: "Failed to archive", variant: "destructive" });
      return;
    }
    toast({ title: "Removed from schedule list" });
    fetchPlaceholders();
  };

  const fetchStaffMembers = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];
      if (userIds.length === 0) {
        setStaffMembers([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name, created_at')
        .in('user_id', userIds);
      if (profilesError) throw profilesError;

      const staffMap = new Map<string, StaffMember>();
      for (const profile of profilesData || []) {
        staffMap.set(profile.user_id, {
          userId: profile.user_id,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          roles: [],
          createdAt: profile.created_at,
        });
      }

      for (const role of rolesData || []) {
        const staff = staffMap.get(role.user_id);
        if (staff) staff.roles.push(role.role as AppRole);
      }

      setStaffMembers(Array.from(staffMap.values()));
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast({ title: "Error", description: "Failed to load staff members", variant: "destructive" });
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground">Manage staff access, roles, and invitations</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPlaceholderDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add to Schedule
            </Button>
            <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Send Invite
            </Button>
          </div>
        </div>

        <FrontDeskLoginCard />

        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active Staff</TabsTrigger>
            <TabsTrigger value="unactivated">Unactivated ({placeholders.length})</TabsTrigger>
            <TabsTrigger value="invites">Pending Invites</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
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
                  <p className="text-muted-foreground">No active staff members found</p>
                  <p className="text-sm text-muted-foreground">Send an invite to add staff</p>
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staff) => (
                      <TableRow
                        key={staff.userId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/staff-roles/${staff.userId}`)}
                      >
                        <TableCell className="font-medium">
                          <button
                            className="text-left hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/staff-roles/${staff.userId}`);
                            }}
                          >
                            {staff.firstName} {staff.lastName}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{staff.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {staff.roles.slice(0, 3).map((role) => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {ROLE_LABELS[role]}
                              </Badge>
                            ))}
                            {staff.roles.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{staff.roles.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Active</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {staff.createdAt ? format(new Date(staff.createdAt), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/staff-roles/${staff.userId}`);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="unactivated" className="space-y-4">
            {placeholders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No unactivated staff</p>
                  <p className="text-sm text-muted-foreground">Use "Add to Schedule" to roster someone without sending an invite.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placeholders.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{p.email ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.phone ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.roles.slice(0, 3).map((role) => (
                              <Badge key={role} variant="secondary" className="text-xs">{ROLE_LABELS[role]}</Badge>
                            ))}
                            {p.roles.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{p.roles.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(p.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => archivePlaceholder(p.id)}>
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="invites">
            <PendingInvitesTab />
          </TabsContent>
        </Tabs>

        <InviteStaffDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onInviteSent={fetchStaffMembers}
        />
        <AddPlaceholderStaffDialog
          open={placeholderDialogOpen}
          onOpenChange={setPlaceholderDialogOpen}
          onCreated={fetchPlaceholders}
        />
      </div>
    </AdminLayout>
  );
}
