import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MemberDetailSheet } from "@/components/admin/MemberDetailSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Filter, MoreHorizontal, UserPlus, Mail, Loader2, AlertTriangle, DollarSign, ShoppingBag, CheckCircle2, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUserRoles } from "@/hooks/useUserRoles";
import { SellMembershipPackage } from "@/components/admin/SellMembershipPackage";
import { SellClassPackage } from "@/components/admin/SellClassPackage";
import { format } from "date-fns";
import { checkMemberPaymentStatus } from "@/hooks/usePaymentStatus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "pending_activation":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "past_due":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "frozen":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "suspended":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "cancelled":
    case "expired":
    case "inactive":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

const getMembershipColor = (membership: string) => {
  const lowerMembership = membership?.toLowerCase() || "";
  if (lowerMembership.includes("diamond")) {
    return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
  }
  if (lowerMembership.includes("platinum")) {
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
  if (lowerMembership.includes("gold")) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  }
  if (lowerMembership.includes("silver")) {
    return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
  }
  return "bg-secondary text-secondary-foreground";
};

// Normalize tier name for display
const normalizeTierDisplay = (membership: string): string => {
  const lower = membership?.toLowerCase() || "";
  if (lower.includes("diamond")) return "Diamond";
  if (lower.includes("platinum")) return "Platinum";
  if (lower.includes("gold")) return "Gold";
  if (lower.includes("silver")) return "Silver";
  return membership;
};

const formatStatus = (status: string) => {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
};

export default function Members() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<typeof members[0] | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [showClassPackageDialog, setShowClassPackageDialog] = useState(false);
  const [foundingMemberFilter, setFoundingMemberFilter] = useState<boolean | null>(null);
  const [billingTypeFilter, setBillingTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Super Admin Activation state (moved from MemberDetailSheet)
  const [memberToActivate, setMemberToActivate] = useState<typeof members[0] | null>(null);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  
  // Activation email state
  const [isSendingActivationEmail, setIsSendingActivationEmail] = useState(false);
  const [isSendingBulkEmails, setIsSendingBulkEmails] = useState(false);
  
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useUserRoles();

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select(`
          id,
          member_id,
          first_name,
          last_name,
          email,
          phone,
          membership_type,
          status,
          membership_start_date,
          membership_end_date,
          billing_type,
          gender,
          is_founding_member,
          stripe_customer_id,
          stripe_subscription_id,
          annual_fee_paid_at,
          annual_fee_subscription_id,
          created_at,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          user_id,
          activation_email_sent_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredMembers = members.filter((member) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      member.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.member_id.toLowerCase().includes(searchQuery.toLowerCase());

    // Founding member filter
    const matchesFounding = foundingMemberFilter === null || 
      (foundingMemberFilter === true && member.is_founding_member === true) ||
      (foundingMemberFilter === false && member.is_founding_member !== true);

    // Billing type filter
    const matchesBilling = billingTypeFilter === "all" ||
      (billingTypeFilter === "monthly" && (member.billing_type === "monthly" || !member.billing_type)) ||
      (billingTypeFilter === "annual" && member.billing_type === "annual");

    // Status filter
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;

    return matchesSearch && matchesFounding && matchesBilling && matchesStatus;
  });

  // Get pending activation members for bulk email
  const pendingActivationMembers = filteredMembers.filter(m => m.status === "pending_activation");

  // Send activation email to single member
  const sendActivationEmail = async (member: typeof members[0], e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSendingActivationEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "member_activation_setup",
          to: member.email,
          data: {
            name: member.first_name,
            email: member.email,
            membershipTier: member.membership_type,
            launchDate: "February 9, 2026",
            hasCardOnFile: !!member.card_last4,
            hasSignedAgreement: false,
          },
        },
      });
      if (error) throw error;

      // Update activation_email_sent_at
      await supabase
        .from("members")
        .update({ activation_email_sent_at: new Date().toISOString() })
        .eq("id", member.id);

      toast.success(`Activation email sent to ${member.first_name}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error sending activation email:", error);
      toast.error("Failed to send activation email");
    } finally {
      setIsSendingActivationEmail(false);
    }
  };

  // Send bulk activation emails
  const sendBulkActivationEmails = async () => {
    const membersToEmail = pendingActivationMembers;
    if (membersToEmail.length === 0) {
      toast.error("No pending activation members to email");
      return;
    }
    
    setIsSendingBulkEmails(true);
    let successCount = 0;
    let failCount = 0;

    for (const member of membersToEmail) {
      try {
        const { error } = await supabase.functions.invoke("send-email", {
          body: {
            type: "member_activation_setup",
            to: member.email,
            data: {
              name: member.first_name,
              email: member.email,
              membershipTier: member.membership_type,
              launchDate: "February 9, 2026",
              hasCardOnFile: !!member.card_last4,
              hasSignedAgreement: false,
            },
          },
        });
        if (error) throw error;

        await supabase
          .from("members")
          .update({ activation_email_sent_at: new Date().toISOString() })
          .eq("id", member.id);

        successCount++;
      } catch (error) {
        console.error(`Failed to send email to ${member.email}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Sent ${successCount} activation email${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} email${failCount > 1 ? 's' : ''}`);
    }
    
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    setIsSendingBulkEmails(false);
  };

  const handleViewProfile = (member: typeof members[0]) => {
    // Navigate to full member detail page
    navigate(`/admin/members/${member.id}`);
  };

  const handleCheckIn = (member: typeof members[0]) => {
    navigate(`/admin/check-in?member=${member.member_id}`);
  };

  // Super Admin activation handler
  const handleActivateMember = async () => {
    if (!memberToActivate) return;
    setIsActivating(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({ 
          status: "active",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", memberToActivate.id);
      if (error) throw error;
      toast.success("Member activated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setShowActivateDialog(false);
      setMemberToActivate(null);
      setIsSheetOpen(false);
    } catch (error) {
      console.error("Error activating member:", error);
      toast.error(error instanceof Error ? error.message : "Failed to activate member");
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <AdminLayout title="Members">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowMembershipDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Process Payment
            </Button>
            <Button variant="outline" onClick={() => setShowClassPackageDialog(true)}>
              <ShoppingBag className="h-4 w-4 mr-2" />
              Sell Package
            </Button>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_activation">Pending Activation</SelectItem>
              <SelectItem value="frozen">Frozen</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={foundingMemberFilter === null ? "all" : foundingMemberFilter ? "founding" : "regular"} onValueChange={(v) => {
            if (v === "all") setFoundingMemberFilter(null);
            else setFoundingMemberFilter(v === "founding");
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Member Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="founding">Founding Members</SelectItem>
              <SelectItem value="regular">Regular Members</SelectItem>
            </SelectContent>
          </Select>

          <Select value={billingTypeFilter} onValueChange={setBillingTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Billing Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Billing Types</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>

          {/* Bulk activation email button */}
          {pendingActivationMembers.length > 0 && (
            <Button 
              variant="outline" 
              onClick={sendBulkActivationEmails}
              disabled={isSendingBulkEmails}
            >
              {isSendingBulkEmails ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Activation Emails ({pendingActivationMembers.length})
            </Button>
          )}
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Members ({filteredMembers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Error loading members. Please try again.
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No members match your search." : "No members yet."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email Sent</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewProfile(member)}>
                      <TableCell className="font-mono text-sm">
                        {member.member_id}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {member.first_name} {member.last_name}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={getMembershipColor(member.membership_type)}>
                            {normalizeTierDisplay(member.membership_type)}
                          </Badge>
                          {member.is_founding_member && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                              Founding
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={getStatusColor(member.status)}>
                              {formatStatus(member.status)}
                            </Badge>
                            {checkMemberPaymentStatus({
                              status: member.status,
                              annual_fee_paid_at: member.annual_fee_paid_at,
                              stripe_subscription_id: member.stripe_subscription_id,
                            }).hasPaymentIssues && (
                              <span title="Payment issue">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              </span>
                            )}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={
                              member.annual_fee_paid_at || member.annual_fee_subscription_id
                                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-xs"
                            }
                          >
                            {member.annual_fee_paid_at || member.annual_fee_subscription_id ? "Initiation Fee Paid" : "Initiation Fee Unpaid"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.status === "pending_activation" ? (
                          (member as any).activation_email_sent_at ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Sent {format(new Date((member as any).activation_email_sent_at), "MMM d")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">
                              Not sent
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.membership_start_date
                          ? format(new Date(member.membership_start_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedMember(member);
                              setShowMembershipDialog(true);
                            }}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Process Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedMember(member);
                              setShowClassPackageDialog(true);
                            }}>
                              <ShoppingBag className="h-4 w-4 mr-2" />
                              Sell Package
                            </DropdownMenuItem>
                            {member.status === "pending_activation" && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendActivationEmail(member, e as any);
                                }}
                                disabled={isSendingActivationEmail}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Send Activation Email
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleCheckIn(member)}>
                              Check In
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                              View Payment History
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <MemberDetailSheet
          member={selectedMember}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onRequestSuperActivate={(member: any) => {
            setMemberToActivate(member);
            setShowActivateDialog(true);
          }}
        />

        <SellMembershipPackage
          open={showMembershipDialog}
          onOpenChange={setShowMembershipDialog}
          memberId={selectedMember?.id}
          memberEmail={selectedMember?.email}
        />
        <SellClassPackage
          open={showClassPackageDialog}
          onOpenChange={setShowClassPackageDialog}
          userId={selectedMember?.user_id}
        />

        {/* Super Admin Activation Dialog - OUTSIDE THE SHEET */}
        <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activate Member (Super Admin)</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to activate {memberToActivate?.first_name} {memberToActivate?.last_name}'s membership.
                This will grant them full member access immediately.
                <br /><br />
                <strong className="text-foreground">Note:</strong> This action bypasses normal payment requirements.
                Make sure any required payments have been collected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleActivateMember}
                disabled={isActivating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isActivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Activation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
