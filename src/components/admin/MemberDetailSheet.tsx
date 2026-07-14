import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { StripeProvider } from "@/components/StripeProvider";
import { AdminAddCardForm } from "./AdminAddCardForm";
import { CreateSubscriptionDialog } from "./CreateSubscriptionDialog";
import { ChargeItemSelector } from "./ChargeItemSelector";
import { AdminActionButton, ADMIN_ACTION_TOOLTIPS } from "./AdminActionButton";
import { ChangeBillingDateDialog } from "./ChangeBillingDateDialog";
import { AddProcessingFeesButton } from "./AddProcessingFeesButton";
import { CafeCreditPanel } from "./cafe/CafeCreditPanel";
import { MemberCreditsPanel } from "./MemberCreditsPanel";
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
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Phone, Calendar, CreditCard, User, Trash2, DollarSign, FileText, Tag, Activity, BarChart3, Plus, Edit2, X, ShoppingBag, PlayCircle, Settings, AlertCircle, CheckCircle2, ExternalLink, XCircle, RefreshCcw, Eye, RotateCcw, KeyRound, CalendarClock, MessageSquare, Coffee } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ChargeHistory } from "@/components/ChargeHistory";
import { SendSmsDialog } from "./SendSmsDialog";
import { useMemberNotes, useCreateMemberNote, useUpdateMemberNote, useDeleteMemberNote } from "@/hooks/useMemberNotes";
import { useMemberTags, useCreateMemberTag, useDeleteMemberTag } from "@/hooks/useMemberTags";
import { useMemberActivities } from "@/hooks/useMemberActivities";
import { useQuery } from "@tanstack/react-query";
import { checkMemberPaymentStatus } from "@/hooks/usePaymentStatus";
import { useAdminMemberPaymentMethods, useRefreshAdminMemberPaymentMethods } from "@/hooks/useAdminMemberPaymentMethods";
import { useRetryInvoice, useSyncMemberStatus, useDeactivateMember } from "@/hooks/usePaymentTracking";
import { NextPaymentCard } from "./MemberDetail/NextPaymentCard";

interface Member {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  membership_type: string;
  status: string;
  subscription_status: string | null;
  membership_start_date: string;
  membership_end_date: string | null;
  billing_type: string | null;
  gender: string | null;
  is_founding_member: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  annual_fee_paid_at: string | null;
  annual_fee_subscription_id: string | null;
  next_billing_date?: string | null;
  next_annual_fee_date?: string | null;
  created_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  user_id: string | null;
}

interface MemberDetailSheetProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSuperActivate?: (member: Member) => void;
  /**
   * "frontdesk" hides destructive admin actions (delete, suspend) while still
   * exposing credit adjustments and on-behalf bookings.
   */
  viewerMode?: "admin" | "frontdesk";
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

// Component to display all payment methods from Stripe
function PaymentMethodsSection({ 
  member, 
  onShowChargeDialog, 
  setShowCancelAnnualFeeDialog,
  setShowClearInitiationFeeDialog,
  getStripeSubscriptionLink 
}: { 
  member: Member; 
  onShowChargeDialog: () => void;
  setShowCancelAnnualFeeDialog: (show: boolean) => void;
  setShowClearInitiationFeeDialog: (show: boolean) => void;
  getStripeSubscriptionLink: (id: string) => string;
}) {
  const { data: stripePaymentMethods, isLoading: isLoadingPMs } = useAdminMemberPaymentMethods(member.id);
  const refreshPaymentMethods = useRefreshAdminMemberPaymentMethods();

  return (
    <div className="text-sm space-y-2">
      {/* Card details display from Stripe */}
      {isLoadingPMs ? (
        <div className="flex items-center gap-2 p-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading cards...</span>
        </div>
      ) : stripePaymentMethods?.paymentMethods && stripePaymentMethods.paymentMethods.length > 0 ? (
        <div className="space-y-2">
           {stripePaymentMethods.paymentMethods.map((pm) => (
             <div key={pm.id} className={`flex items-center gap-2 p-2 rounded-md border ${pm.isDefault ? 'bg-accent/10 border-accent/50' : 'bg-muted/30 border-transparent'}`}>
               {pm.isDefault ? (
                 <span className="text-accent text-lg">★</span>
               ) : (
                 <CreditCard className="h-4 w-4 text-muted-foreground" />
               )}
               <span className="font-medium">{pm.brand?.toUpperCase()} •••• {pm.last4}</span>
               {pm.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
               <span className="text-muted-foreground text-xs ml-auto">
                 Exp: {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
               </span>
             </div>
           ))}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refreshPaymentMethods.mutate(member.id)}
            disabled={refreshPaymentMethods.isPending}
            className="text-xs"
          >
            <RefreshCcw className={`h-3 w-3 mr-1 ${refreshPaymentMethods.isPending ? 'animate-spin' : ''}`} />
            Refresh from Stripe
          </Button>
        </div>
      ) : member.card_brand && member.card_last4 ? (
        // Fallback to cached metadata if Stripe fetch failed
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{member.card_brand.toUpperCase()} •••• {member.card_last4}</span>
            {member.card_exp_month && member.card_exp_year && (
              <span className="text-muted-foreground text-xs ml-auto">
                Exp: {String(member.card_exp_month).padStart(2, '0')}/{member.card_exp_year}
              </span>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refreshPaymentMethods.mutate(member.id)}
            disabled={refreshPaymentMethods.isPending}
            className="text-xs"
          >
            <RefreshCcw className={`h-3 w-3 mr-1 ${refreshPaymentMethods.isPending ? 'animate-spin' : ''}`} />
            Fetch from Stripe
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No cards on file</p>
      )}
      
      <p className="text-muted-foreground text-xs">
        Stripe Customer: <span className="font-mono">{member.stripe_customer_id}</span>
      </p>
      {member.stripe_subscription_id && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>Membership Subscription:</span>
          <a 
            href={getStripeSubscriptionLink(member.stripe_subscription_id)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            {member.stripe_subscription_id.substring(0, 18)}...
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      
      {/* Annual Fee Subscription Section */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-sm font-medium mb-2">Initiation Fee Status</p>
        {member.annual_fee_subscription_id ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Active Subscription</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span>Subscription ID:</span>
              <a 
                href={getStripeSubscriptionLink(member.annual_fee_subscription_id)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {member.annual_fee_subscription_id.substring(0, 18)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {member.annual_fee_paid_at && (
              <p className="text-xs text-muted-foreground">
                Last Paid: {format(new Date(member.annual_fee_paid_at), "MMM d, yyyy")}
              </p>
            )}
            <div className="flex gap-2">
              <AdminActionButton
                label="Cancel Subscription"
                icon={<XCircle className="h-4 w-4 mr-2" />}
                variant="outline"
                tooltip={ADMIN_ACTION_TOOLTIPS.cancelAnnualFee}
                onClick={() => setShowCancelAnnualFeeDialog(true)}
              />
              <AdminActionButton
                label="Clear Fee Status"
                icon={<Trash2 className="h-4 w-4 mr-2" />}
                variant="destructive"
                tooltip="Clear the initiation fee payment status if it was incorrectly marked as paid. This does NOT issue a refund."
                onClick={() => setShowClearInitiationFeeDialog(true)}
              />
            </div>
          </div>
        ) : member.annual_fee_paid_at ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Paid (One-time)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Paid on: {format(new Date(member.annual_fee_paid_at), "MMM d, yyyy")}
            </p>
            <AdminActionButton
              label="Clear Fee Status"
              icon={<Trash2 className="h-4 w-4 mr-2" />}
              variant="destructive"
              tooltip="Clear the initiation fee payment status if it was incorrectly marked as paid. This does NOT issue a refund."
              onClick={() => setShowClearInitiationFeeDialog(true)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Not Paid</span>
          </div>
        )}
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full mt-2"
        onClick={onShowChargeDialog}
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
  );
}

export function MemberDetailSheet({ member, open, onOpenChange, onRequestSuperActivate, viewerMode = "admin" }: MemberDetailSheetProps) {
  const isFrontDesk = viewerMode === "frontdesk";
  const queryClient = useQueryClient();
  const { isSuperAdmin, loading: rolesLoading } = useUserRoles();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  
  // Add Card state
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [addCardClientSecret, setAddCardClientSecret] = useState<string | null>(null);
  const [addCardCustomerId, setAddCardCustomerId] = useState<string | null>(null);
  const [isCreatingSetupIntent, setIsCreatingSetupIntent] = useState(false);
  
  // Account Linking state
  const [linkEmail, setLinkEmail] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  // Annual fee subscription cancel state
  const [showCancelAnnualFeeDialog, setShowCancelAnnualFeeDialog] = useState(false);
  const [isCancelingAnnualFee, setIsCancelingAnnualFee] = useState(false);
  
  // Clear initiation fee state (for incorrect accounting)
  const [showClearInitiationFeeDialog, setShowClearInitiationFeeDialog] = useState(false);
  const [isClearingInitiationFee, setIsClearingInitiationFee] = useState(false);
  
  // Create subscription state
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [showCreateSubscriptionDialog, setShowCreateSubscriptionDialog] = useState(false);

  // Change billing date state
  const [showChangeBillingDate, setShowChangeBillingDate] = useState(false);

  // Retry / Deactivate hooks
  const retryInvoice = useRetryInvoice();
  const syncMemberStatus = useSyncMemberStatus();
  const deactivateMemberAction = useDeactivateMember();
  
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    membership_type: "",
    status: "",
    gender: "",
    billing_type: "",
    membership_start_date: "",
    activated_at: "",
    is_founding_member: false,
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
        gender: member.gender || "",
        billing_type: member.billing_type || "monthly",
        membership_start_date: member.membership_start_date || "",
        activated_at: (member as any).activated_at || "",
        is_founding_member: member.is_founding_member || false,
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
          gender: editForm.gender || null,
          billing_type: editForm.billing_type || null,
          membership_start_date: editForm.membership_start_date || null,
          activated_at: editForm.activated_at || null,
          is_founding_member: editForm.is_founding_member,
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

  // handleActivateMember was moved to Members.tsx to fix dialog z-index issues

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

  const handleAddCard = async () => {
    if (!member) return;
    
    setIsCreatingSetupIntent(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: {
          action: 'create_admin_setup_intent',
          stripeCustomerId: member.stripe_customer_id,
          applicantEmail: member.email,
          applicantName: `${member.first_name} ${member.last_name}`,
          memberId: member.id,  // NEW: Allow edge function to persist customer ID
        },
      });
      
      if (error) throw error;
      if (!data?.clientSecret) throw new Error("Failed to create setup intent");
      
      setAddCardClientSecret(data.clientSecret);
      setAddCardCustomerId(data.customerId);
      setShowAddCardForm(true);
    } catch (err) {
      console.error("Error creating setup intent:", err);
      toast.error("Failed to initialize card form");
    } finally {
      setIsCreatingSetupIntent(false);
    }
  };

  const handleAddCardSuccess = () => {
    setShowAddCardForm(false);
    setAddCardClientSecret(null);
    setAddCardCustomerId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    toast.success("Card saved successfully");
  };

  const handleAddCardCancel = () => {
    setShowAddCardForm(false);
    setAddCardClientSecret(null);
    setAddCardCustomerId(null);
  };

  // Account linking handler
  const handleLinkAccount = async () => {
    if (!member || !linkEmail.trim()) return;
    setIsLinking(true);
    try {
      const { data, error } = await supabase.rpc("admin_link_member_to_user", {
        _member_id: member.id,
        _user_email: linkEmail.trim(),
      });
      if (error) throw error;
      if (!data) throw new Error("No user account found with that email address. The user must create an account first.");
      toast.success("Member account successfully linked!");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setLinkEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to link account");
    } finally {
      setIsLinking(false);
    }
  };

  // Cancel annual fee subscription handler
  const handleCancelAnnualFeeSubscription = async () => {
    if (!member || !member.annual_fee_subscription_id) return;
    
    setIsCancelingAnnualFee(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: {
          action: 'cancel_annual_fee_subscription',
          memberId: member.id,
          subscriptionId: member.annual_fee_subscription_id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to cancel subscription");

      toast.success("Annual fee subscription canceled successfully");
      setShowCancelAnnualFeeDialog(false);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error canceling annual fee subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel subscription");
    } finally {
      setIsCancelingAnnualFee(false);
    }
  };

  // Clear initiation fee status handler (for incorrect accounting)
  const handleClearInitiationFee = async () => {
    if (!member) return;
    
    setIsClearingInitiationFee(true);
    try {
      // Update the member record to clear the fee status
      const { error } = await supabase
        .from("members")
        .update({ 
          annual_fee_paid_at: null,
          annual_fee_subscription_id: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", member.id);

      if (error) throw error;

      toast.success("Initiation fee status cleared. Member will need to pay the fee.");
      setShowClearInitiationFeeDialog(false);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error clearing initiation fee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to clear initiation fee status");
    } finally {
      setIsClearingInitiationFee(false);
    }
  };

  // Create membership subscription handler
  const handleCreateSubscription = async (startDate: Date, firstChargeDate: Date | null) => {
    if (!member || !member.stripe_customer_id) return;
    
    setIsCreatingSubscription(true);
    try {
      // Normalize tier and gender from member record
      const tier = member.membership_type.toLowerCase().replace(' membership', '');
      const gender = member.gender?.toLowerCase() === 'male' ? 'men' : 'women';
      const billingType = member.is_founding_member ? 'annual' : (member.billing_type || 'monthly');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired");

      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: {
          action: 'admin_create_member_subscription',
          memberId: member.id,
          tier,
          gender,
          billingType,
          isFoundingMember: member.is_founding_member || false,
          startDate: startDate.toISOString(),
          firstChargeDate: firstChargeDate ? firstChargeDate.toISOString() : null,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const isChargingLater = firstChargeDate && firstChargeDate > new Date();
      toast.success(isChargingLater 
        ? `Subscription created! Card will be charged on ${firstChargeDate.toLocaleDateString()}.` 
        : "Card charged! Membership subscription created successfully."
      );
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create subscription");
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  // Helper to generate Stripe Dashboard link for subscriptions
  const getStripeSubscriptionLink = (subscriptionId: string) => {
    // Test mode subscriptions still use 'sub_' prefix, but we can check the environment
    // For simplicity, we'll use the test dashboard for now (most common during development)
    return `https://dashboard.stripe.com/subscriptions/${subscriptionId}`;
  };

  const canReactivate = member && ["suspended", "cancelled", "inactive", "frozen", "expired"].includes(member.status);

  if (!member) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-screen max-w-none sm:max-w-[95vw] lg:max-w-[1200px] xl:max-w-[1400px] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Member Details
              </SheetTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {/* Will be handled by parent component */}}
                  title="Process Payment"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Process
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {/* Will be handled by parent component */}}
                  title="Sell Package"
                >
                  <ShoppingBag className="h-4 w-4 mr-1" />
                  Sell
                </Button>
                {member.status === "pending_activation" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {/* Will be handled by parent component */}}
                    title="Activate Membership"
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="profile" className="mt-6">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-10 h-auto">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="membership">Membership</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
              <TabsTrigger value="cafe-credit" className="gap-1">
                <Coffee className="h-3.5 w-3.5" /> Cafe Credit
              </TabsTrigger>
              <TabsTrigger value="contract">Contract</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="visits">Visits</TabsTrigger>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Type</Label>
                      <Select value={editForm.billing_type} onValueChange={(v) => setEditForm({ ...editForm, billing_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Membership Type</Label>
                      <Select
                        value={editForm.membership_type}
                        onValueChange={(value) => setEditForm({ ...editForm, membership_type: value })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Silver">Silver</SelectItem>
                          <SelectItem value="Gold">Gold</SelectItem>
                          <SelectItem value="Platinum">Platinum</SelectItem>
                          <SelectItem value="Diamond">Diamond</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editForm.status}
                        onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending_activation">Pending Activation</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={editForm.membership_start_date?.split('T')[0] || ''} onChange={(e) => setEditForm({ ...editForm, membership_start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Activated At</Label>
                      <Input type="date" value={editForm.activated_at?.split('T')[0] || ''} onChange={(e) => setEditForm({ ...editForm, activated_at: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="sheet_edit_founding"
                      checked={editForm.is_founding_member}
                      onChange={(e) => setEditForm({ ...editForm, is_founding_member: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="sheet_edit_founding">Founding Member</Label>
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
                      <p className="flex-1">{member.phone}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSmsDialogOpen(true)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Send SMS
                      </Button>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p>{member.gender || "Not specified"}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={startEditing} variant="outline" className="flex-1">
                      Edit Details
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open(`/member/membership?admin_view=${member.id}`, '_blank')}
                      className="flex-1"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Portal
                    </Button>
                  </div>

                  {/* Account Linking Section */}
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Account Linking
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {member.user_id ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">User account linked</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">No user account linked</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This member has not signed up yet, or signed up with a different email.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter user's signup email"
                              value={linkEmail}
                              onChange={(e) => setLinkEmail(e.target.value)}
                              className="flex-1 text-sm"
                            />
                            <Button
                              onClick={handleLinkAccount}
                              disabled={!linkEmail.trim() || isLinking}
                              size="sm"
                            >
                              {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            The user must have already created an account. Email matching is case-insensitive.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="membership" className="space-y-4 mt-4">
              <NextPaymentCard memberId={member.id} />

              {/* Subscription Status Alert */}
              {member.subscription_status && ['incomplete', 'incomplete_expired', 'past_due', 'unpaid'].includes(member.subscription_status) && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="space-y-3 flex-1">
                        <div>
                          <p className="font-semibold text-destructive">Subscription Payment Failed</p>
                          <p className="text-sm text-muted-foreground">
                            Subscription status: <Badge variant="destructive" className="ml-1">{member.subscription_status}</Badge>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              retryInvoice.mutateAsync(member.id).then(r => {
                                if (r.status === 'paid') toast.success("Payment succeeded!");
                                else toast.error(`Payment status: ${r.status}`);
                                queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                              }).catch((e: Error) => toast.error(e.message));
                            }}
                            disabled={retryInvoice.isPending || !member.stripe_subscription_id}
                          >
                            {retryInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                            Retry Payment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              syncMemberStatus.mutateAsync(member.id).then(r => {
                                toast.success(r.synced ? `Status synced: ${r.currentStatus}` : "Already in sync");
                                queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                              }).catch(() => toast.error("Sync failed"));
                            }}
                            disabled={syncMemberStatus.isPending}
                          >
                            <RefreshCcw className={`h-4 w-4 mr-2 ${syncMemberStatus.isPending ? 'animate-spin' : ''}`} />
                            Sync Status
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              deactivateMemberAction.mutateAsync(member.id).then(() => {
                                toast.success("Member deactivated");
                                queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                                onOpenChange(false);
                              }).catch((e: Error) => toast.error(e.message));
                            }}
                            disabled={deactivateMemberAction.isPending}
                          >
                            {deactivateMemberAction.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Deactivate Member
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Status Panel */}
              {(() => {
                const paymentStatus = checkMemberPaymentStatus({
                  status: member.status,
                  annual_fee_paid_at: member.annual_fee_paid_at,
                  stripe_subscription_id: member.stripe_subscription_id,
                });
                
                if (paymentStatus.hasPaymentIssues) {
                  return (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                          <div className="space-y-2 flex-1">
                            <p className="font-semibold text-destructive">Payment Issues — Benefits Frozen</p>
                            <div className="text-sm space-y-1">
                              <div className="flex items-center justify-between">
                                <span>Initiation Fee:</span>
                                {paymentStatus.isInitiationFeePaid ? (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">Unpaid</Badge>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Subscription:</span>
                                {paymentStatus.hasActiveSubscription ? (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Active
                                  </Badge>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="destructive">Not Started</Badge>
                                    {member.stripe_customer_id && (
                                      <AdminActionButton
                                        label="Create"
                                        tooltip={ADMIN_ACTION_TOOLTIPS.createSubscription}
                                        onClick={() => setShowCreateSubscriptionDialog(true)}
                                        isLoading={isCreatingSubscription}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              {paymentStatus.isDuesPastDue && (
                                <div className="flex items-center justify-between">
                                  <span>Dues Status:</span>
                                  <Badge variant="destructive">Past Due</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                
                return (
                  <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-700 dark:text-green-400">All Payments Current</p>
                          <p className="text-sm text-muted-foreground">Member benefits are active</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

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
                  <PaymentMethodsSection member={member} onShowChargeDialog={() => setShowChargeDialog(true)} setShowCancelAnnualFeeDialog={setShowCancelAnnualFeeDialog} setShowClearInitiationFeeDialog={setShowClearInitiationFeeDialog} getStripeSubscriptionLink={getStripeSubscriptionLink} />
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

              {!rolesLoading && isSuperAdmin() && member.status !== "active" && onRequestSuperActivate && (
                <Button 
                  type="button"
                  variant="default" 
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  onClick={() => onRequestSuperActivate(member)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Activate Member (Super Admin)
                </Button>
              )}

              <AdminActionButton
                label="Send Password Reset"
                icon={<KeyRound className="h-4 w-4 mr-2" />}
                variant="outline"
                tooltip={ADMIN_ACTION_TOOLTIPS.sendPasswordReset}
                className="w-full mt-4"
                confirmationConfig={{
                  title: "Send Password Reset Link?",
                  description: (
                    <p>A password reset email will be sent to <strong>{member.email}</strong>. They can use the link to set a new password.</p>
                  ),
                  confirmLabel: "Send Reset Link",
                }}
                onClick={async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
                    redirectTo: `${window.location.origin}/update-password`,
                  });
                  if (error) {
                    toast.error(`Failed to send reset link: ${error.message}`);
                  } else {
                    toast.success(`Password reset link sent to ${member.email}`);
                  }
                }}
              />

              {!isFrontDesk && member.status !== "suspended" && member.status !== "cancelled" && member.status === "active" && (
                <Button 
                  variant="destructive" 
                  className="w-full mt-4"
                  onClick={() => setShowSuspendDialog(true)}
                >
                  Suspend Membership
                </Button>
              )}

              {!isFrontDesk && isSuperAdmin() && (
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

            <TabsContent value="credits" className="space-y-4 mt-4">
              <MemberCreditsPanel
                memberId={member.id}
                userId={member.user_id}
                memberName={`${member.first_name} ${member.last_name}`}
              />
            </TabsContent>

            <TabsContent value="cafe-credit" className="space-y-4 mt-4">
              <CafeCreditPanel member={{ id: member.id, first_name: member.first_name, last_name: member.last_name, stripe_customer_id: (member as any).stripe_customer_id }} />
            </TabsContent>

            <TabsContent value="contract" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Membership Contract</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contract_membership_type">Membership Type</Label>
                      <Select 
                        value={member.membership_type} 
                        onValueChange={async (value) => {
                          try {
                            await supabase.from("members").update({ membership_type: value }).eq("id", member.id);
                            toast.success("Membership type updated");
                            queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                          } catch (error) {
                            toast.error("Failed to update membership type");
                          }
                        }}
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
                    <div>
                      <Label htmlFor="contract_billing_type">Billing Type</Label>
                      <Select 
                        value={member.billing_type || "monthly"} 
                        onValueChange={async (value) => {
                          try {
                            await supabase.from("members").update({ billing_type: value }).eq("id", member.id);
                            toast.success("Billing type updated");
                            queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                          } catch (error) {
                            toast.error("Failed to update billing type");
                          }
                        }}
                        disabled={member.is_founding_member === true}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                      {member.is_founding_member && (
                        <p className="text-xs text-muted-foreground mt-1">Founding members are always annual</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="contract_founding"
                      checked={member.is_founding_member || false}
                      onChange={async (e) => {
                        try {
                          const isFounding = e.target.checked;
                          await supabase.from("members").update({ 
                            is_founding_member: isFounding,
                            billing_type: isFounding ? "annual" : (member.billing_type || "monthly")
                          }).eq("id", member.id);
                          toast.success(`Member marked as ${isFounding ? "founding" : "regular"}`);
                          queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                        } catch (error) {
                          toast.error("Failed to update founding member status");
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor="contract_founding" className="cursor-pointer">Founding Member</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={member.membership_start_date ? format(new Date(member.membership_start_date), "yyyy-MM-dd") : ""}
                        onChange={async (e) => {
                          try {
                            await supabase.from("members").update({ 
                              membership_start_date: e.target.value 
                            }).eq("id", member.id);
                            toast.success("Start date updated");
                            queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                          } catch (error) {
                            toast.error("Failed to update start date");
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>End Date (Optional)</Label>
                      <Input
                        type="date"
                        value={member.membership_end_date ? format(new Date(member.membership_end_date), "yyyy-MM-dd") : ""}
                        onChange={async (e) => {
                          try {
                            await supabase.from("members").update({ 
                              membership_end_date: e.target.value || null
                            }).eq("id", member.id);
                            toast.success("End date updated");
                            queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                          } catch (error) {
                            toast.error("Failed to update end date");
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {member.stripe_customer_id ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Stripe Customer ID</p>
                        <p className="text-sm font-mono text-muted-foreground break-all">{member.stripe_customer_id}</p>
                        {member.stripe_subscription_id && (
                          <>
                            <p className="text-sm font-medium mt-4">Stripe Subscription ID</p>
                            <p className="text-sm font-mono text-muted-foreground break-all">{member.stripe_subscription_id}</p>
                          </>
                        )}
                      </div>

                      {/* Add Another Card Button */}
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-3">Payment Methods</p>
                        {showAddCardForm && addCardClientSecret ? (
                          <div className="border rounded-lg p-4 bg-muted/30">
                            <p className="text-sm font-medium mb-3">Add Payment Method</p>
                            <StripeProvider clientSecret={addCardClientSecret}>
                              <AdminAddCardForm
                                onSuccess={handleAddCardSuccess}
                                onCancel={handleAddCardCancel}
                                memberId={member.id}
                                stripeCustomerId={addCardCustomerId || undefined}
                              />
                            </StripeProvider>
                          </div>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleAddCard}
                            disabled={isCreatingSetupIntent}
                          >
                            {isCreatingSetupIntent ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Initializing...
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Another Card
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      
                      <div className="pt-4 border-t">
                        <ChargeHistory 
                          memberId={member.id}
                          isAdmin={true}
                          recipientEmail={member.email}
                          recipientName={member.first_name}
                        />
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-3">Subscription Management</p>
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.functions.invoke("stripe-payment", {
                                  body: {
                                    action: "pause_subscription",
                                    subscriptionId: member.stripe_subscription_id,
                                  },
                                });
                                if (error) throw error;
                                toast.success("Subscription paused");
                                queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                              } catch (error) {
                                toast.error("Failed to pause subscription");
                              }
                            }}
                            disabled={!member.stripe_subscription_id}
                          >
                            Pause Subscription
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.functions.invoke("stripe-payment", {
                                  body: {
                                    action: "cancel_subscription",
                                    subscriptionId: member.stripe_subscription_id,
                                  },
                                });
                                if (error) throw error;
                                toast.success("Subscription cancelled");
                                queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                              } catch (error) {
                                toast.error("Failed to cancel subscription");
                              }
                            }}
                            disabled={!member.stripe_subscription_id}
                          >
                            Cancel Subscription
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowChangeBillingDate(true)}
                            disabled={!member.stripe_subscription_id}
                          >
                            <CalendarClock className="h-4 w-4 mr-1" />
                            Change Billing Date
                          </Button>
                          <AddProcessingFeesButton
                            subscriptionId={member.stripe_subscription_id || ""}
                            annualFeeSubscriptionId={member.annual_fee_subscription_id}
                            memberName={`${member.first_name} ${member.last_name}`}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Initiation Fee Status</p>
                        {member.annual_fee_paid_at ? (
                          <p className="text-sm text-muted-foreground">
                            Paid on {format(new Date(member.annual_fee_paid_at), "MMM d, yyyy")}
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-amber-600">Not paid</p>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.functions.invoke("stripe-payment", {
                                    body: {
                                      action: "charge_annual_fee",
                                      memberId: member.id,
                                      customerId: member.stripe_customer_id,
                                    },
                                  });
                                  if (error) throw error;
                                  toast.success("Initiation fee charged");
                                  queryClient.invalidateQueries({ queryKey: ["admin-members"] });
                                } catch (error) {
                                  toast.error("Failed to charge initiation fee");
                                }
                              }}
                            >
                              Charge Initiation Fee
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">No payment method on file</p>
                      
                      {showAddCardForm && addCardClientSecret ? (
                        <div className="border rounded-lg p-4 bg-muted/30 text-left">
                          <p className="text-sm font-medium mb-3">Add Payment Method</p>
                          <StripeProvider clientSecret={addCardClientSecret}>
                            <AdminAddCardForm
                              onSuccess={handleAddCardSuccess}
                              onCancel={handleAddCardCancel}
                              memberId={member.id}
                              stripeCustomerId={addCardCustomerId || undefined}
                            />
                          </StripeProvider>
                        </div>
                      ) : (
                        <Button 
                          onClick={handleAddCard}
                          disabled={isCreatingSetupIntent}
                        >
                          {isCreatingSetupIntent ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Initializing...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Card
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <MemberNotesSection memberId={member.id} />
              <MemberTagsSection memberId={member.id} />
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              <MemberActivityTimeline memberId={member.id} />
            </TabsContent>

            <TabsContent value="visits" className="space-y-4 mt-4">
              <MemberVisitHistory memberId={member.id} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-4">
              <MemberAnalytics memberId={member.id} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Create Subscription Confirmation Dialog */}
      <CreateSubscriptionDialog
        open={showCreateSubscriptionDialog}
        onOpenChange={setShowCreateSubscriptionDialog}
        member={member}
        isLoading={isCreatingSubscription}
        onConfirm={handleCreateSubscription}
      />

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

      {/* Activation AlertDialog moved to Members.tsx to fix z-index issues with Sheet */}

      <ChargeItemSelector
        open={showChargeDialog}
        onOpenChange={setShowChargeDialog}
        member={member}
        onChargeSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-members"] });
        }}
      />
      {/* Cancel Annual Fee Subscription Dialog */}
      <AlertDialog open={showCancelAnnualFeeDialog} onOpenChange={setShowCancelAnnualFeeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Annual Fee Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the annual initiation fee subscription for {member.first_name} {member.last_name}. 
              The subscription will be canceled in Stripe and the member record will be updated.
              <br /><br />
              <strong>Note:</strong> This does not issue a refund. To refund the member, visit the 
              <a 
                href={member.annual_fee_subscription_id ? `https://dashboard.stripe.com/subscriptions/${member.annual_fee_subscription_id}` : '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Stripe Dashboard
              </a>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelingAnnualFee}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAnnualFeeSubscription}
              disabled={isCancelingAnnualFee}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelingAnnualFee && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Clear Initiation Fee Status Dialog */}
      <AlertDialog open={showClearInitiationFeeDialog} onOpenChange={setShowClearInitiationFeeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Clear Initiation Fee Status?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the initiation fee payment status for <strong>{member.first_name} {member.last_name}</strong>.
              <br /><br />
              <strong className="text-destructive">Warning:</strong> Use this only if the member was incorrectly marked as paid 
              (e.g., payment failed but status wasn't updated, or data entry error).
              <br /><br />
              After clearing:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>The member will be required to pay the initiation fee</li>
                <li>Their benefits will be frozen until payment is received</li>
                <li>This does NOT issue a refund - handle refunds separately in Stripe</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingInitiationFee}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearInitiationFee}
              disabled={isClearingInitiationFee}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isClearingInitiationFee && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clear Fee Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Billing Date Dialog */}
      {member && (
        <ChangeBillingDateDialog
          open={showChangeBillingDate}
          onOpenChange={setShowChangeBillingDate}
          memberId={member.id}
          memberName={`${member.first_name} ${member.last_name}`}
          subscriptionId={member.stripe_subscription_id}
          annualFeeSubscriptionId={member.annual_fee_subscription_id}
        />
      )}

      <SendSmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        recipient={{
          userId: member.user_id,
          name: `${member.first_name} ${member.last_name}`.trim(),
          phone: member.phone,
        }}
      />
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
        if (data.source === 'amenity_log') {
          const typeLabels: Record<string, string> = {
            sauna: 'Sauna', salt_room: 'Salt Room', cold_plunge: 'Cold Plunge',
            steam_room: 'Steam Room', zero_body_cryo: 'Zero Body Cryo', red_light_therapy: 'Red Light Therapy',
          };
          return `Amenity: ${typeLabels[data.amenity_type] || data.amenity_type}${data.duration_minutes ? ` (${data.duration_minutes} min)` : ''}`;
        }
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

// Member Visit History Component
function MemberVisitHistory({ memberId }: { memberId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["member-visit-history", memberId],
    queryFn: async () => {
      // Lifetime total (no row cap)
      const { count: totalCount, error: totalErr } = await supabase
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .eq("member_id", memberId);
      if (totalErr) throw totalErr;

      // This calendar month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: monthCount, error: monthErr } = await supabase
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .eq("member_id", memberId)
        .gte("checked_in_at", monthStart);
      if (monthErr) throw monthErr;

      // Full timeline, paginated past the 1000-row PostgREST cap
      const rows: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: batch, error } = await supabase
          .from("check_ins")
          .select("*")
          .eq("member_id", memberId)
          .order("checked_in_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        const b = batch || [];
        rows.push(...b);
        if (b.length < batchSize) break;
        offset += batchSize;
      }

      return { checkIns: rows, total: totalCount ?? rows.length, thisMonth: monthCount ?? 0 };
    },
  });

  const checkIns = data?.checkIns;
  const thisMonth = data?.thisMonth ?? 0;
  const total = data?.total ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total Visits</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{thisMonth}</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
      </div>


      {checkIns && checkIns.length > 0 ? (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {checkIns.map((ci) => (
            <div key={ci.id} className="flex items-center justify-between p-3 rounded-md border bg-card">
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(ci.checked_in_at), "EEE, MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  In: {format(new Date(ci.checked_in_at), "h:mm a")}
                  {ci.checked_out_at && ` · Out: ${format(new Date(ci.checked_out_at), "h:mm a")}`}
                </p>
              </div>
              {ci.notes && (
                <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {ci.notes}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-6">No visit history found.</p>
      )}
    </div>
  );
}

// Member Analytics Component
function MemberAnalytics({ memberId }: { memberId: string }) {
  const { data: ltv, isLoading: ltvLoading } = useQuery({
    queryKey: ["member-ltv", memberId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("calculate_member_ltv", {
          p_member_id: memberId,
        });
        if (error) {
          console.warn("calculate_member_ltv RPC not available:", error);
          return 0;
        }
        return (data as number) || 0;
      } catch (error) {
        console.warn("Failed to calculate LTV:", error);
        return 0;
      }
    },
  });

  const { data: churnRisk, isLoading: churnLoading } = useQuery({
    queryKey: ["member-churn-risk", memberId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("calculate_churn_risk", {
          p_member_id: memberId,
        });
        if (error) {
          console.warn("calculate_churn_risk RPC not available:", error);
          return 0;
        }
        return (data as number) || 0;
      } catch (error) {
        console.warn("Failed to calculate churn risk:", error);
        return 0;
      }
    },
  });

  const { data: engagementScore, isLoading: engagementLoading } = useQuery({
    queryKey: ["member-engagement", memberId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("calculate_engagement_score", {
          p_member_id: memberId,
          p_days: 30,
        });
        if (error) {
          console.warn("calculate_engagement_score RPC not available:", error);
          return 0;
        }
        return (data as number) || 0;
      } catch (error) {
        console.warn("Failed to calculate engagement score:", error);
        return 0;
      }
    },
  });

  const { data: attendancePattern, isLoading: attendanceLoading } = useQuery({
    queryKey: ["member-attendance-pattern", memberId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_member_attendance_pattern", {
          p_member_id: memberId,
          p_days: 30,
        });
        if (error) {
          console.warn("get_member_attendance_pattern RPC not available:", error);
          return { total_classes: 0, avg_classes_per_week: 0 };
        }
        return (data as any) || { total_classes: 0, avg_classes_per_week: 0 };
      } catch (error) {
        console.warn("Failed to get attendance pattern:", error);
        return { total_classes: 0, avg_classes_per_week: 0 };
      }
    },
  });

  const { data: serviceUtilization, isLoading: utilizationLoading } = useQuery({
    queryKey: ["member-service-utilization", memberId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_member_service_utilization", {
          p_member_id: memberId,
          p_days: 30,
        });
        if (error) {
          console.warn("get_member_service_utilization RPC not available:", error);
          return { classes_attended: 0, spa_services: 0, cafe_orders: 0, workouts_logged: 0 };
        }
        return (data as any) || { classes_attended: 0, spa_services: 0, cafe_orders: 0, workouts_logged: 0 };
      } catch (error) {
        console.warn("Failed to get service utilization:", error);
        return { classes_attended: 0, spa_services: 0, cafe_orders: 0, workouts_logged: 0 };
      }
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
