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
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Phone, Calendar, CreditCard, User, Trash2, DollarSign, FileText, Tag, Activity, BarChart3, Plus, Edit2, X } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ChargeHistory } from "@/components/ChargeHistory";
import { useMemberNotes, useCreateMemberNote, useUpdateMemberNote, useDeleteMemberNote } from "@/hooks/useMemberNotes";
import { useMemberTags, useCreateMemberTag, useDeleteMemberTag } from "@/hooks/useMemberTags";
import { useMemberActivities } from "@/hooks/useMemberActivities";
import { useQuery } from "@tanstack/react-query";

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
  const { isSuperAdmin } = useUserRoles();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
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

  const handleDelete = async () => {
    if (!member) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;

      toast.success("Member deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting member:", error);
      toast.error("Failed to delete member");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async () => {
    if (!member) return;
    
    setIsReactivating(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({ 
          status: "active",
          updated_at: new Date().toISOString()
        })
        .eq("id", member.id);

      if (error) throw error;

      toast.success("Membership reactivated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setShowReactivateDialog(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error reactivating member:", error);
      toast.error("Failed to reactivate membership");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleChargeCard = async () => {
    if (!member) return;
    
    const amountInCents = Math.round(parseFloat(chargeAmount) * 100);
    
    if (isNaN(amountInCents) || amountInCents < 50) {
      toast.error("Minimum charge amount is $0.50");
      return;
    }

    if (!chargeDescription.trim()) {
      toast.error("Please enter a description for the charge");
      return;
    }

    setIsCharging(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: {
          action: 'charge_saved_card',
          memberId: member.id,
          amount: amountInCents,
          description: chargeDescription.trim(),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Charge failed");

      toast.success(`Successfully charged $${chargeAmount} to ${member.first_name}'s card`);
      setShowChargeDialog(false);
      setChargeAmount("");
      setChargeDescription("");
    } catch (error) {
      console.error("Error charging card:", error);
      toast.error(error instanceof Error ? error.message : "Failed to charge card");
    } finally {
      setIsCharging(false);
    }
  };

  const canReactivate = member && ["suspended", "cancelled", "inactive", "frozen", "expired"].includes(member.status);

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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="membership">Membership</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
                  <div className="text-sm space-y-2">
                    <p className="text-muted-foreground">
                      Stripe Customer: <span className="font-mono text-xs">{member.stripe_customer_id}</span>
                    </p>
                    {member.stripe_subscription_id && (
                      <p className="text-muted-foreground">
                        Subscription: <span className="font-mono text-xs">{member.stripe_subscription_id}</span>
                      </p>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => setShowChargeDialog(true)}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Charge Saved Card
                    </Button>
                    <div className="mt-4">
                      <ChargeHistory 
                        memberId={member.id}
                        isAdmin={true}
                        recipientEmail={member.email}
                        recipientName={member.first_name}
                      />
                    </div>
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

              {canReactivate && (
                <Button 
                  variant="default" 
                  className="w-full mt-4"
                  onClick={() => setShowReactivateDialog(true)}
                >
                  Reactivate Membership
                </Button>
              )}

              {member.status !== "suspended" && member.status !== "cancelled" && member.status === "active" && (
                <Button 
                  variant="destructive" 
                  className="w-full mt-4"
                  onClick={() => setShowSuspendDialog(true)}
                >
                  Suspend Membership
                </Button>
              )}

              {isSuperAdmin() && (
                <Button 
                  variant="destructive" 
                  className="w-full mt-2"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Member Permanently
                </Button>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <MemberNotesSection memberId={member.id} />
              <MemberTagsSection memberId={member.id} />
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              <MemberActivityTimeline memberId={member.id} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-4">
              <MemberAnalytics memberId={member.id} />
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {member.first_name} {member.last_name} and all their 
              associated records (bookings, credits, check-ins). This action CANNOT be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reactivate the membership for {member.first_name} {member.last_name}. 
              They will regain access to club facilities based on their membership tier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReactivate}
              disabled={isReactivating}
            >
              {isReactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charge Saved Card</DialogTitle>
            <DialogDescription>
              Charge {member.first_name} {member.last_name}'s saved payment method for an off-cycle purchase (café, late fees, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chargeAmount">Amount (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="chargeAmount"
                  type="number"
                  step="0.01"
                  min="0.50"
                  placeholder="0.00"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chargeDescription">Description</Label>
              <Textarea
                id="chargeDescription"
                placeholder="e.g., Café purchase, Late cancellation fee, Guest pass"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeDialog(false)} disabled={isCharging}>
              Cancel
            </Button>
            <Button onClick={handleChargeCard} disabled={isCharging}>
              {isCharging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Charge ${chargeAmount || "0.00"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Member Notes Section Component
function MemberNotesSection({ memberId }: { memberId: string }) {
  const { data: notes, isLoading } = useMemberNotes(memberId);
  const createNote = useCreateMemberNote();
  const updateNote = useUpdateMemberNote();
  const deleteNote = useDeleteMemberNote();
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;
    await createNote.mutateAsync({
      member_id: memberId,
      note_text: newNoteText.trim(),
      is_internal: true,
    });
    setNewNoteText("");
    setIsAdding(false);
  };

  const handleUpdateNote = async (id: string) => {
    if (!editText.trim()) return;
    await updateNote.mutateAsync({ id, note_text: editText.trim() });
    setEditingId(null);
    setEditText("");
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      await deleteNote.mutateAsync({ id, memberId });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notes
        </h3>
        <Button size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardContent className="pt-6">
            <Textarea
              placeholder="Enter note..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleCreateNote} disabled={createNote.isPending}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewNoteText(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {notes && notes.length > 0 ? (
          notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="pt-6">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdateNote(note.id)} disabled={updateNote.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditText(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(note.id); setEditText(note.note_text); }}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteNote(note.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
        )}
      </div>
    </div>
  );
}

// Member Tags Section Component
function MemberTagsSection({ memberId }: { memberId: string }) {
  const { data: tags, isLoading } = useMemberTags(memberId);
  const createTag = useCreateMemberTag();
  const deleteTag = useDeleteMemberTag();
  const [newTag, setNewTag] = useState("");

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    await createTag.mutateAsync({
      member_id: memberId,
      tag: newTag.trim(),
    });
    setNewTag("");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Tags
        </h3>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
        />
        <Button onClick={handleAddTag} disabled={createTag.isPending || !newTag.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags && tags.length > 0 ? (
          tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-2">
              {tag.tag}
              <button
                onClick={() => deleteTag.mutate({ id: tag.id, memberId })}
                className="hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No tags yet</p>
        )}
      </div>
    </div>
  );
}

// Member Activity Timeline Component
function MemberActivityTimeline({ memberId }: { memberId: string }) {
  const { data: activities, isLoading } = useMemberActivities(memberId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'class_attended': return '🏋️';
      case 'spa_service': return '💆';
      case 'cafe_order': return '☕';
      case 'kids_care_booking': return '👶';
      case 'workout_logged': return '💪';
      default: return '📝';
    }
  };

  const getActivityDescription = (activity: any) => {
    const data = activity.activity_data || {};
    switch (activity.activity_type) {
      case 'class_attended':
        return `Attended ${data.class_name || 'class'} on ${data.session_date || ''}`;
      case 'spa_service':
        return `Spa service: ${data.service_name || ''}`;
      case 'cafe_order':
        return `Cafe order: $${data.total_amount || 0}`;
      case 'kids_care_booking':
        return `Kids care: ${data.child_name || ''}`;
      case 'workout_logged':
        return `Workout: ${data.workout_type || ''}`;
      default:
        return activity.activity_type;
    }
  };

  // Group activities by date
  const groupedActivities = (activities || []).reduce((acc, activity) => {
    const date = format(new Date(activity.created_at), "yyyy-MM-dd");
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, typeof activities>);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Activity Timeline
      </h3>

      {Object.keys(groupedActivities).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedActivities)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, dateActivities]) => (
              <div key={date}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                </h4>
                <div className="space-y-2">
                  {dateActivities
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((activity) => (
                      <Card key={activity.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{getActivityIcon(activity.activity_type)}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {getActivityDescription(activity)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(activity.created_at), "h:mm a")}
                              </p>
                              {activity.points_earned > 0 && (
                                <Badge variant="outline" className="mt-2">
                                  +{activity.points_earned} points
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No activities yet</p>
      )}
    </div>
  );
}

// Member Analytics Component
function MemberAnalytics({ memberId }: { memberId: string }) {
  const { data: ltv, isLoading: ltvLoading } = useQuery({
    queryKey: ["member-ltv", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_member_ltv", {
        p_member_id: memberId,
      });
      if (error) throw error;
      return data as number;
    },
  });

  const { data: churnRisk, isLoading: churnLoading } = useQuery({
    queryKey: ["member-churn-risk", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_churn_risk", {
        p_member_id: memberId,
      });
      if (error) throw error;
      return data as number;
    },
  });

  const { data: engagementScore, isLoading: engagementLoading } = useQuery({
    queryKey: ["member-engagement", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_engagement_score", {
        p_member_id: memberId,
        p_days: 30,
      });
      if (error) throw error;
      return data as number;
    },
  });

  const { data: attendancePattern, isLoading: attendanceLoading } = useQuery({
    queryKey: ["member-attendance-pattern", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_attendance_pattern", {
        p_member_id: memberId,
        p_days: 30,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: serviceUtilization, isLoading: utilizationLoading } = useQuery({
    queryKey: ["member-service-utilization", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_service_utilization", {
        p_member_id: memberId,
        p_days: 30,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const isLoading = ltvLoading || churnLoading || engagementLoading || attendanceLoading || utilizationLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Analytics
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifetime Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${Number(ltv || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total revenue generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Churn Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(churnRisk || 0) > 50 ? 'text-destructive' : (churnRisk || 0) > 25 ? 'text-amber-600' : 'text-success'}`}>
              {churnRisk || 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Risk of cancellation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{engagementScore || 0}/100</p>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{attendancePattern?.total_classes || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {attendancePattern?.avg_classes_per_week || 0} avg/week
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Service Utilization (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{serviceUtilization?.classes_attended || 0}</p>
                <p className="text-xs text-muted-foreground">Classes</p>
              </div>
              <div>
                <p className="text-xl font-bold">{serviceUtilization?.spa_services || 0}</p>
                <p className="text-xs text-muted-foreground">Spa</p>
              </div>
              <div>
                <p className="text-xl font-bold">{serviceUtilization?.cafe_orders || 0}</p>
                <p className="text-xs text-muted-foreground">Cafe</p>
              </div>
              <div>
                <p className="text-xl font-bold">{serviceUtilization?.workouts_logged || 0}</p>
                <p className="text-xs text-muted-foreground">Workouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
