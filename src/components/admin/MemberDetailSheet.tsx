import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Phone, Calendar, CreditCard, User } from "lucide-react";

interface Member {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  membership_type: string;
  status: string;
  membership_start_date: string;
  membership_end_date: string | null;
  billing_type: string | null;
  gender: string | null;
  is_founding_member: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
}

interface MemberDetailSheetProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

const formatStatus = (status: string) => {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
};

export function MemberDetailSheet({ member, open, onOpenChange }: MemberDetailSheetProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    membership_type: "",
    status: "",
  });

  const startEditing = () => {
    if (member) {
      setEditForm({
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone || "",
        membership_type: member.membership_type,
        status: member.status,
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveChanges = async () => {
    if (!member) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          phone: editForm.phone || null,
          membership_type: editForm.membership_type,
          status: editForm.status,
        })
        .eq("id", member.id);

      if (error) throw error;

      toast.success("Member details updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Failed to update member details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!member) return;
    
    try {
      const { error } = await supabase
        .from("members")
        .update({ status: "suspended" })
        .eq("id", member.id);

      if (error) throw error;

      toast.success("Membership suspended");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setShowSuspendDialog(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error suspending member:", error);
      toast.error("Failed to suspend membership");
    }
  };

  if (!member) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Member Details
            </SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="profile" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="membership">Membership</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="membership_type">Membership Type</Label>
                    <Select
                      value={editForm.membership_type}
                      onValueChange={(value) => setEditForm({ ...editForm, membership_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Silver">Silver</SelectItem>
                        <SelectItem value="Gold">Gold</SelectItem>
                        <SelectItem value="Platinum">Platinum</SelectItem>
                        <SelectItem value="Diamond">Diamond</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending_activation">Pending Activation</SelectItem>
                        <SelectItem value="frozen">Frozen</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={saveChanges} disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Member ID</p>
                      <p className="font-mono">{member.member_id}</p>
                    </div>
                    <Badge variant="secondary" className={getStatusColor(member.status)}>
                      {formatStatus(member.status)}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-lg font-medium">{member.first_name} {member.last_name}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p>{member.email}</p>
                  </div>

                  {member.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <p>{member.phone}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p>{member.gender || "Not specified"}</p>
                  </div>

                  <Button onClick={startEditing} variant="outline" className="w-full">
                    Edit Details
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="membership" className="space-y-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">Membership Type</p>
                <p className="text-lg font-medium">{member.membership_type}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Billing Type</p>
                <p className="capitalize">{member.billing_type || "Monthly"}</p>
              </div>

              {member.is_founding_member && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                  Founding Member
                </Badge>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p>{member.membership_start_date 
                    ? format(new Date(member.membership_start_date), "MMM d, yyyy")
                    : "—"}</p>
                </div>
              </div>

              {member.membership_end_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p>{format(new Date(member.membership_end_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </p>
                {member.stripe_customer_id ? (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Stripe Customer: <span className="font-mono text-xs">{member.stripe_customer_id}</span>
                    </p>
                    {member.stripe_subscription_id && (
                      <p className="text-muted-foreground">
                        Subscription: <span className="font-mono text-xs">{member.stripe_subscription_id}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment method on file</p>
                )}
              </div>

              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">Member Since</p>
                <p>{member.created_at 
                  ? format(new Date(member.created_at), "MMM d, yyyy")
                  : "—"}</p>
              </div>

              {member.status !== "suspended" && member.status !== "cancelled" && (
                <Button 
                  variant="destructive" 
                  className="w-full mt-4"
                  onClick={() => setShowSuspendDialog(true)}
                >
                  Suspend Membership
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend the membership for {member.first_name} {member.last_name}. 
              They will lose access to club facilities. This action can be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} className="bg-destructive text-destructive-foreground">
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
