import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StripeProvider } from "@/components/StripeProvider";
import { AdminAddCardForm } from "@/components/admin/AdminAddCardForm";
import { ChargeHistory } from "@/components/ChargeHistory";
import { useMemberNotes, useCreateMemberNote, useUpdateMemberNote, useDeleteMemberNote } from "@/hooks/useMemberNotes";
import { useMemberTags, useCreateMemberTag, useDeleteMemberTag } from "@/hooks/useMemberTags";
import { useMemberActivities } from "@/hooks/useMemberActivities";
import { checkMemberPaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_TYPE_LABELS, CreditType } from "@/lib/memberCredits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Mail, Phone, Calendar, CreditCard, User, Trash2, DollarSign, 
  FileText, Tag, Activity, BarChart3, Plus, Edit2, X, Settings, 
  AlertCircle, CheckCircle2, ExternalLink, XCircle, Loader2, PlayCircle,
  Clock, Shield, Snowflake, Crown, RefreshCcw, Coins, Minus, ArrowUpCircle, ArrowDownCircle
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Helper functions
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

const getMembershipColor = (membership: string) => {
  const lower = membership?.toLowerCase() || "";
  if (lower.includes("diamond")) return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
  if (lower.includes("platinum")) return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  if (lower.includes("gold")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  if (lower.includes("silver")) return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
  return "bg-secondary text-secondary-foreground";
};

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

const getStripeSubscriptionLink = (subscriptionId: string) => {
  return `https://dashboard.stripe.com/subscriptions/${subscriptionId}`;
};

const getPriceDisplay = (tier: string, billingType: string, gender: string) => {
  const prices: Record<string, Record<string, Record<string, number>>> = {
    silver: { monthly: { women: 200, men: 120 }, annual: { women: 2400, men: 1440 } },
    gold: { monthly: { women: 250, men: 155 }, annual: { women: 3000, men: 1860 } },
    platinum: { monthly: { women: 350, men: 175 }, annual: { women: 4200, men: 2100 } },
    diamond: { monthly: { women: 500, men: 500 }, annual: { women: 6000, men: 6000 } },
  };
  const normalizedTier = tier?.toLowerCase().replace(' membership', '') || 'gold';
  const normalizedBilling = billingType || 'monthly';
  const normalizedGender = gender?.toLowerCase() === 'male' ? 'men' : 'women';
  const price = prices[normalizedTier]?.[normalizedBilling]?.[normalizedGender] || 0;
  const interval = normalizedBilling === 'annual' ? '/yr' : '/mo';
  return `$${price}${interval}`;
};

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useUserRoles();
  const { user } = useAuth();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showSubscriptionSuccessDialog, setShowSubscriptionSuccessDialog] = useState(false);
  const [subscriptionResult, setSubscriptionResult] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");

  // Add Card state
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [addCardClientSecret, setAddCardClientSecret] = useState<string | null>(null);
  const [addCardCustomerId, setAddCardCustomerId] = useState<string | null>(null);
  const [isCreatingSetupIntent, setIsCreatingSetupIntent] = useState(false);

  // Cancel annual fee state
  const [showCancelAnnualFeeDialog, setShowCancelAnnualFeeDialog] = useState(false);
  const [isCancelingAnnualFee, setIsCancelingAnnualFee] = useState(false);

  // Credit adjustment state
  const [showAdjustCreditDialog, setShowAdjustCreditDialog] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [adjustCreditType, setAdjustCreditType] = useState<CreditType>("class");
  const [adjustAmount, setAdjustAmount] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    membership_type: "",
    status: "",
  });

  // Fetch member data
  const { data: member, isLoading, error } = useQuery({
    queryKey: ["admin-member-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("No member ID");
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch member credits
  const { data: memberCredits = [], isLoading: isCreditsLoading } = useQuery({
    queryKey: ["member-credits", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("member_credits")
        .select("*")
        .eq("member_id", id)
        .gt("expires_at", new Date().toISOString())
        .order("credit_type", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch credit adjustment history for this member
  const { data: creditAdjustments = [], isLoading: isAdjustmentsLoading } = useQuery({
    queryKey: ["member-credit-adjustments", id],
    queryFn: async () => {
      if (!id) return [];
      const { data: adjustments, error } = await supabase
        .from("credit_adjustments")
        .select("*")
        .eq("member_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Get staff info
      const staffIds = [...new Set((adjustments || []).map((a) => a.adjusted_by))];
      const { data: staffData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", staffIds);

      const staffMap = new Map((staffData || []).map((s) => [s.user_id, s]));

      return (adjustments || []).map((adj) => ({
        ...adj,
        staff: staffMap.get(adj.adjusted_by),
      }));
    },
    enabled: !!id,
  });

  // Fetch credit usage history (class bookings that used credits)
  const { data: creditUsageHistory = [], isLoading: isCreditUsageLoading } = useQuery({
    queryKey: ["member-credit-usage", id],
    queryFn: async () => {
      if (!id) return [];
      
      // Get class bookings that used credits
      const { data: classBookings, error: bookingsError } = await supabase
        .from("class_bookings")
        .select(`
          id,
          booked_at,
          credits_used,
          status,
          member_credit_id,
          session:class_sessions(
            id,
            session_date,
            start_time,
            class_type:class_types(name, category)
          ),
          credit:member_credits(credit_type)
        `)
        .eq("member_id", id)
        .gt("credits_used", 0)
        .order("booked_at", { ascending: false })
        .limit(50);
      
      if (bookingsError) throw bookingsError;
      
      // Transform to unified format
      const usageHistory: any[] = [];
      
      // Add class bookings
      (classBookings || []).forEach((booking) => {
        const session = booking.session as any;
        const credit = booking.credit as any;
        usageHistory.push({
          id: booking.id,
          date: booking.booked_at,
          service_type: 'class',
          service_name: session?.class_type?.name || 'Class',
          service_details: session ? `${format(new Date(session.session_date), 'MMM d')} at ${session.start_time}` : null,
          credit_type: credit?.credit_type || 'class',
          credits_used: booking.credits_used,
          status: booking.status,
        });
      });
      
      return usageHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!id,
  });

  // Credit adjustment mutation
  const adjustCreditMutation = useMutation({
    mutationFn: async ({
      creditType,
      adjustment,
      reason,
    }: {
      creditType: CreditType;
      adjustment: number;
      reason: string;
    }) => {
      if (!user || !id) throw new Error("Not authenticated");

      const credit = memberCredits.find((c) => c.credit_type === creditType);
      
      if (!credit) {
        throw new Error(`No active ${CREDIT_TYPE_LABELS[creditType]} credits found for this member`);
      }

      const previousBalance = credit.credits_remaining;
      const newRemaining = Math.max(0, Math.min(credit.credits_total + 50, previousBalance + adjustment));

      // Update the credit balance
      const { error: updateError } = await supabase
        .from("member_credits")
        .update({ credits_remaining: newRemaining })
        .eq("id", credit.id);

      if (updateError) throw updateError;

      // Log the adjustment
      const { error: logError } = await supabase
        .from("credit_adjustments")
        .insert({
          member_id: id,
          member_credit_id: credit.id,
          credit_type: creditType,
          adjustment_type: adjustment > 0 ? "add" : "remove",
          amount: Math.abs(adjustment),
          previous_balance: previousBalance,
          new_balance: newRemaining,
          reason: reason || null,
          adjusted_by: user.id,
        });

      if (logError) throw logError;

      return { newRemaining, creditType };
    },
    onSuccess: (data) => {
      toast.success(`${CREDIT_TYPE_LABELS[data.creditType]} adjusted to ${data.newRemaining} credits`);
      queryClient.invalidateQueries({ queryKey: ["member-credits", id] });
      queryClient.invalidateQueries({ queryKey: ["member-credit-adjustments", id] });
      setShowAdjustCreditDialog(false);
      setAdjustAmount("1");
      setAdjustReason("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to adjust credits");
    },
  });

  // Hooks for notes, tags, activities
  const { data: notes = [] } = useMemberNotes(member?.id);
  const { data: tags = [] } = useMemberTags(member?.id);
  const { data: activities = [] } = useMemberActivities(member?.id);
  const createNote = useCreateMemberNote();
  const deleteNote = useDeleteMemberNote();
  const createTag = useCreateMemberTag();
  const deleteTag = useDeleteMemberTag();

  // Payment status
  const paymentStatus = member ? checkMemberPaymentStatus({
    status: member.status,
    annual_fee_paid_at: member.annual_fee_paid_at,
    stripe_subscription_id: member.stripe_subscription_id,
  }) : null;

  // Edit handlers
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
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to update member details");
    } finally {
      setIsSaving(false);
    }
  };

  // Action handlers
  const handleSuspend = async () => {
    if (!member) return;
    try {
      const { error } = await supabase.from("members").update({ status: "suspended" }).eq("id", member.id);
      if (error) throw error;
      toast.success("Membership suspended");
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      setShowSuspendDialog(false);
    } catch (error) {
      toast.error("Failed to suspend membership");
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("members").delete().eq("id", member.id);
      if (error) throw error;
      toast.success("Member deleted permanently");
      navigate("/admin/members");
    } catch (error) {
      toast.error("Failed to delete member");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async () => {
    if (!member) return;
    setIsReactivating(true);
    try {
      const { error } = await supabase.from("members").update({ 
        status: "active", 
        updated_at: new Date().toISOString() 
      }).eq("id", member.id);
      if (error) throw error;
      toast.success("Membership reactivated");
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      setShowReactivateDialog(false);
    } catch (error) {
      toast.error("Failed to reactivate membership");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleActivate = async () => {
    if (!member) return;
    setIsActivating(true);
    try {
      const { error } = await supabase.from("members").update({ 
        status: "active",
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", member.id);
      if (error) throw error;
      toast.success("Member activated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      setShowActivateDialog(false);
    } catch (error) {
      toast.error("Failed to activate member");
    } finally {
      setIsActivating(false);
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
      toast.error("Please enter a description");
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

      toast.success(`Successfully charged $${chargeAmount}`);
      setShowChargeDialog(false);
      setChargeAmount("");
      setChargeDescription("");
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to charge card");
    } finally {
      setIsCharging(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!member || !member.stripe_customer_id) return;
    
    setIsCreatingSubscription(true);
    try {
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
          startDate: member.membership_start_date || new Date().toISOString().split('T')[0],
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Show success dialog with details
      setSubscriptionResult({
        ...data,
        tier: normalizeTierDisplay(member.membership_type),
        billingType: member.is_founding_member ? 'Annual (Founding)' : (member.billing_type === 'annual' ? 'Annual' : 'Monthly'),
        price: getPriceDisplay(tier, billingType, gender),
        creditsAllocated: data.creditsAllocated || getCreditsForTier(tier),
      });
      setShowSubscriptionSuccessDialog(true);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create subscription");
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const getCreditsForTier = (tier: string) => {
    const credits: Record<string, { class: number; red_light: number; dry_cryo: number }> = {
      silver: { class: 0, red_light: 0, dry_cryo: 0 },
      gold: { class: 8, red_light: 4, dry_cryo: 4 },
      platinum: { class: 16, red_light: 8, dry_cryo: 8 },
      diamond: { class: 999, red_light: 999, dry_cryo: 999 },
    };
    return credits[tier?.toLowerCase()] || credits.gold;
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
        },
      });
      
      if (error) throw error;
      if (!data?.clientSecret) throw new Error("Failed to create setup intent");
      
      setAddCardClientSecret(data.clientSecret);
      setAddCardCustomerId(data.customerId);
      setShowAddCardForm(true);
    } catch (err) {
      toast.error("Failed to initialize card form");
    } finally {
      setIsCreatingSetupIntent(false);
    }
  };

  const handleAddCardSuccess = () => {
    setShowAddCardForm(false);
    setAddCardClientSecret(null);
    setAddCardCustomerId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
    toast.success("Card saved successfully");
  };

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
      if (!data?.success) throw new Error(data?.error || "Failed to cancel");

      toast.success("Annual fee subscription canceled");
      setShowCancelAnnualFeeDialog(false);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel subscription");
    } finally {
      setIsCancelingAnnualFee(false);
    }
  };

  const canReactivate = member && ["suspended", "cancelled", "inactive", "frozen", "expired"].includes(member.status);

  if (isLoading) {
    return (
      <AdminLayout title="Member Details">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !member) {
    return (
      <AdminLayout title="Member Details">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Member not found</h2>
          <Button onClick={() => navigate("/admin/members")}>Back to Members</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="">
      <div className="space-y-6">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/members">Members</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{member.first_name} {member.last_name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin/members")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{member.first_name} {member.last_name}</h1>
                <p className="text-muted-foreground font-mono text-sm">{member.member_id}</p>
              </div>
              <Badge className={getStatusColor(member.status)}>{formatStatus(member.status)}</Badge>
              {member.is_founding_member && (
                <Badge className="bg-amber-100 text-amber-800"><Crown className="h-3 w-3 mr-1" />Founding</Badge>
              )}
            </div>
            <div className="flex gap-2">
              {member.status === "pending_activation" && isSuperAdmin && (
                <Button onClick={() => setShowActivateDialog(true)}>
                  <PlayCircle className="h-4 w-4 mr-2" />Activate
                </Button>
              )}
              {canReactivate && (
                <Button variant="outline" onClick={() => setShowReactivateDialog(true)}>
                  <RefreshCcw className="h-4 w-4 mr-2" />Reactivate
                </Button>
              )}
              <Button variant="outline" onClick={startEditing}>
                <Edit2 className="h-4 w-4 mr-2" />Edit
              </Button>
              {member.status !== "suspended" && (
                <Button variant="outline" onClick={() => setShowSuspendDialog(true)}>
                  <XCircle className="h-4 w-4 mr-2" />Suspend
                </Button>
              )}
              {isSuperAdmin && (
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Membership</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getMembershipColor(member.membership_type)}>
                {normalizeTierDisplay(member.membership_type)}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {member.billing_type === 'annual' ? 'Annual' : 'Monthly'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {getPriceDisplay(member.membership_type, member.billing_type || 'monthly', member.gender || 'female')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card on File</CardTitle>
            </CardHeader>
            <CardContent>
              {member.card_brand && member.card_last4 ? (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium capitalize">{member.card_brand}</span>
                  <span>•••• {member.card_last4}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">No card</span>
              )}
              <Button size="sm" variant="link" className="p-0 h-auto mt-1" onClick={handleAddCard} disabled={isCreatingSetupIntent}>
                {isCreatingSetupIntent ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {member.card_brand ? 'Update Card' : 'Add Card'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Initiation Fee</CardTitle>
            </CardHeader>
            <CardContent>
              {member.annual_fee_paid_at ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Paid</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Unpaid</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              {member.stripe_subscription_id ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Active</span>
                  </div>
                  <a 
                    href={getStripeSubscriptionLink(member.stripe_subscription_id)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View in Stripe <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">None</span>
                  </div>
                  {member.stripe_customer_id && member.card_brand && (
                    <Button size="sm" onClick={handleCreateSubscription} disabled={isCreatingSubscription}>
                      {isCreatingSubscription && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Create
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile"><User className="h-4 w-4 mr-2" />Profile</TabsTrigger>
            <TabsTrigger value="membership"><Shield className="h-4 w-4 mr-2" />Membership</TabsTrigger>
            <TabsTrigger value="credits"><Coins className="h-4 w-4 mr-2" />Credits</TabsTrigger>
            <TabsTrigger value="payments"><DollarSign className="h-4 w-4 mr-2" />Payments</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Activity</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name</Label>
                          <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button onClick={saveChanges} disabled={isSaving}>
                          {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{member.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{member.phone || "Not provided"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{member.gender || "Not specified"}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberNotesSection memberId={member.id} notes={notes} createNote={createNote} deleteNote={deleteNote} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <MemberTagsSection memberId={member.id} tags={tags} createTag={createTag} deleteTag={deleteTag} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Membership Tab */}
          <TabsContent value="membership">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Membership Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Member Since</p>
                      <p className="font-medium">{member.membership_start_date ? format(new Date(member.membership_start_date), 'PPP') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Activated</p>
                      <p className="font-medium">{member.activated_at ? format(new Date(member.activated_at), 'PPP') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Type</p>
                      <p className="font-medium capitalize">{member.billing_type || 'Monthly'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">User ID</p>
                      <p className="font-mono text-xs">{member.user_id || 'Not linked'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stripe Integration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer ID</p>
                    <p className="font-mono text-sm">{member.stripe_customer_id || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription ID</p>
                    {member.stripe_subscription_id ? (
                      <a 
                        href={getStripeSubscriptionLink(member.stripe_subscription_id)} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {member.stripe_subscription_id} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-muted-foreground">None</p>
                    )}
                  </div>
                  {member.annual_fee_subscription_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Fee Subscription</p>
                      <div className="flex items-center gap-2">
                        <a 
                          href={getStripeSubscriptionLink(member.annual_fee_subscription_id)} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {member.annual_fee_subscription_id} <ExternalLink className="h-3 w-3" />
                        </a>
                        <Button size="sm" variant="destructive" onClick={() => setShowCancelAnnualFeeDialog(true)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Payment Methods</CardTitle>
                    <Button onClick={handleAddCard} disabled={isCreatingSetupIntent}>
                      {isCreatingSetupIntent && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      <Plus className="h-4 w-4 mr-2" />Add Card
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {member.card_brand && member.card_last4 ? (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-6 w-6" />
                        <div>
                          <p className="font-medium capitalize">{member.card_brand} •••• {member.card_last4}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires {member.card_exp_month}/{member.card_exp_year}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => setShowChargeDialog(true)}>
                        <DollarSign className="h-4 w-4 mr-2" />Charge Card
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No payment method on file</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Charge History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChargeHistory memberId={member.id} isAdmin={true} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Credits Tab */}
          <TabsContent value="credits">
            <div className="space-y-6">
              {/* Current Credits */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Current Credits</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setAdjustmentType("add");
                          setShowAdjustCreditDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />Add
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setAdjustmentType("remove");
                          setShowAdjustCreditDialog(true);
                        }}
                      >
                        <Minus className="h-4 w-4 mr-1" />Remove
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isCreditsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : memberCredits.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No active credits</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(['class', 'red_light', 'dry_cryo'] as CreditType[]).map((type) => {
                        const credit = memberCredits.find((c) => c.credit_type === type);
                        return (
                          <div key={type} className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">{CREDIT_TYPE_LABELS[type]}</p>
                            {credit ? (
                              <>
                                <p className="text-2xl font-bold">
                                  {credit.credits_remaining}
                                  <span className="text-sm font-normal text-muted-foreground">/{credit.credits_total}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Expires {format(new Date(credit.expires_at), 'MMM d, yyyy')}
                                </p>
                              </>
                            ) : (
                              <p className="text-2xl font-bold text-muted-foreground">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Credit Usage History */}
              <Card>
                <CardHeader>
                  <CardTitle>Credit Usage History</CardTitle>
                  <CardDescription>Credits used for class bookings and services</CardDescription>
                </CardHeader>
                <CardContent>
                  {isCreditUsageLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : creditUsageHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No credit usage history</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Credit Type</TableHead>
                          <TableHead>Credits Used</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditUsageHistory.map((usage: any) => (
                          <TableRow key={usage.id}>
                            <TableCell className="text-sm">
                              {format(new Date(usage.date), 'MMM d, yyyy h:mm a')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {usage.service_type === 'class' && <Calendar className="h-4 w-4 text-primary" />}
                                {usage.service_type === 'spa' && <Snowflake className="h-4 w-4 text-cyan-500" />}
                                {usage.service_type === 'wellness' && <Activity className="h-4 w-4 text-emerald-500" />}
                                <div>
                                  <p className="font-medium">{usage.service_name}</p>
                                  {usage.service_details && (
                                    <p className="text-xs text-muted-foreground">{usage.service_details}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {CREDIT_TYPE_LABELS[usage.credit_type as CreditType] || usage.credit_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-rose-600">
                              -{usage.credits_used}
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                usage.status === 'confirmed' || usage.status === 'completed' 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
                                  : usage.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                              }>
                                {usage.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Credit Adjustment History */}
              <Card>
                <CardHeader>
                  <CardTitle>Manual Adjustments</CardTitle>
                  <CardDescription>Credits added or removed by staff</CardDescription>
                </CardHeader>
                <CardContent>
                  {isAdjustmentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : creditAdjustments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No manual adjustments</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credit Type</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Staff</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditAdjustments.map((adj: any) => (
                          <TableRow key={adj.id}>
                            <TableCell className="text-sm">
                              {format(new Date(adj.created_at), 'MMM d, yyyy h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {CREDIT_TYPE_LABELS[adj.credit_type as CreditType] || adj.credit_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {adj.adjustment_type === 'add' ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <ArrowUpCircle className="h-4 w-4" />Add
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-600">
                                  <ArrowDownCircle className="h-4 w-4" />Remove
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {adj.adjustment_type === 'add' ? '+' : '-'}{adj.amount}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {adj.previous_balance} → {adj.new_balance}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={adj.reason || ''}>
                              {adj.reason || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {adj.staff ? `${adj.staff.first_name} ${adj.staff.last_name}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <MemberActivityTimeline activities={activities} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Adjust Credit Dialog */}
      <Dialog open={showAdjustCreditDialog} onOpenChange={setShowAdjustCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustmentType === 'add' ? (
                <><ArrowUpCircle className="h-5 w-5 text-emerald-600" />Add Credits</>
              ) : (
                <><ArrowDownCircle className="h-5 w-5 text-rose-600" />Remove Credits</>
              )}
            </DialogTitle>
            <DialogDescription>
              {adjustmentType === 'add' ? 'Add' : 'Remove'} credits for {member.first_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Credit Type</Label>
              <Select value={adjustCreditType} onValueChange={(v) => setAdjustCreditType(v as CreditType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Class Credits</SelectItem>
                  <SelectItem value="red_light">Red Light Credits</SelectItem>
                  <SelectItem value="dry_cryo">Dry Cryo Credits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input 
                type="number" 
                min="1" 
                value={adjustAmount} 
                onChange={(e) => setAdjustAmount(e.target.value)} 
                placeholder="1"
              />
            </div>
            <div>
              <Label>Reason (required)</Label>
              <Textarea 
                value={adjustReason} 
                onChange={(e) => setAdjustReason(e.target.value)} 
                placeholder="Enter reason for adjustment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustCreditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const amount = parseInt(adjustAmount, 10);
                if (isNaN(amount) || amount <= 0) {
                  toast.error("Please enter a valid amount");
                  return;
                }
                if (!adjustReason.trim()) {
                  toast.error("Please enter a reason");
                  return;
                }
                adjustCreditMutation.mutate({
                  creditType: adjustCreditType,
                  adjustment: adjustmentType === 'add' ? amount : -amount,
                  reason: adjustReason.trim(),
                });
              }}
              disabled={adjustCreditMutation.isPending}
              className={adjustmentType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {adjustCreditMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {adjustmentType === 'add' ? 'Add' : 'Remove'} {adjustAmount} Credit{parseInt(adjustAmount) !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Card Form Dialog */}
      <Dialog open={showAddCardForm} onOpenChange={setShowAddCardForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>Add a new card for {member.first_name}</DialogDescription>
          </DialogHeader>
          {addCardClientSecret && addCardCustomerId && (
            <StripeProvider clientSecret={addCardClientSecret}>
              <AdminAddCardForm
                stripeCustomerId={addCardCustomerId}
                onSuccess={handleAddCardSuccess}
                onCancel={() => setShowAddCardForm(false)}
                memberId={member.id}
              />
            </StripeProvider>
          )}
        </DialogContent>
      </Dialog>

      {/* Charge Card Dialog */}
      <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charge Card</DialogTitle>
            <DialogDescription>Charge {member.first_name}'s card on file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" min="0.50" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} placeholder="Charge reason..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeDialog(false)}>Cancel</Button>
            <Button onClick={handleChargeCard} disabled={isCharging}>
              {isCharging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Charge ${chargeAmount || '0.00'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Success Dialog */}
      <Dialog open={showSubscriptionSuccessDialog} onOpenChange={setShowSubscriptionSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Subscription Created
            </DialogTitle>
          </DialogHeader>
          {subscriptionResult && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-medium">{subscriptionResult.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium">{subscriptionResult.billingType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">{subscriptionResult.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className="bg-green-100 text-green-800">{subscriptionResult.status}</Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Subscription ID</p>
                <a 
                  href={getStripeSubscriptionLink(subscriptionResult.subscriptionId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {subscriptionResult.subscriptionId} <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {subscriptionResult.creditsAllocated && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Credits Allocated</p>
                  <div className="flex gap-2 flex-wrap">
                    {subscriptionResult.creditsAllocated.class > 0 && (
                      <Badge variant="outline">{subscriptionResult.creditsAllocated.class} Class</Badge>
                    )}
                    {subscriptionResult.creditsAllocated.red_light > 0 && (
                      <Badge variant="outline">{subscriptionResult.creditsAllocated.red_light} Red Light</Badge>
                    )}
                    {subscriptionResult.creditsAllocated.dry_cryo > 0 && (
                      <Badge variant="outline">{subscriptionResult.creditsAllocated.dry_cryo} Dry Cryo</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSubscriptionSuccessDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Membership</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend {member.first_name}'s membership? They will lose access to all member benefits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} className="bg-orange-600 hover:bg-orange-700">Suspend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {member.first_name}'s member record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Dialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Membership</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore {member.first_name}'s membership to active status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate} disabled={isReactivating} className="bg-green-600 hover:bg-green-700">
              {isReactivating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Dialog */}
      <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Member (Super Admin)</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to activate {member.first_name}'s membership. This will grant them full member access immediately.
              <br /><br />
              <strong>Note:</strong> This bypasses normal payment requirements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate} disabled={isActivating} className="bg-green-600 hover:bg-green-700">
              {isActivating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirm Activation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Annual Fee Subscription Dialog */}
      <AlertDialog open={showCancelAnnualFeeDialog} onOpenChange={setShowCancelAnnualFeeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Annual Fee Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the recurring annual fee subscription for {member.first_name}. 
              The subscription will be canceled in Stripe and the database record will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelingAnnualFee}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAnnualFeeSubscription} disabled={isCancelingAnnualFee} className="bg-destructive hover:bg-destructive/90">
              {isCancelingAnnualFee && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

// Sub-components
function MemberNotesSection({ memberId, notes, createNote, deleteNote }: any) {
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAdding(true);
    try {
      await createNote.mutateAsync({ member_id: memberId, note_text: newNote.trim() });
      setNewNote("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input 
          placeholder="Add a note..." 
          value={newNote} 
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
        />
        <Button size="sm" onClick={handleAddNote} disabled={isAdding || !newNote.trim()}>
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No notes yet</p>
        ) : (
          notes.map((note: any) => (
            <div key={note.id} className="flex items-start justify-between p-2 bg-muted rounded text-sm">
              <div>
                <p>{note.note_text}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {note.created_at ? format(new Date(note.created_at), 'PPp') : ''}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteNote.mutate(note.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MemberTagsSection({ memberId, tags, createTag, deleteTag }: any) {
  const [newTag, setNewTag] = useState("");

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    await createTag.mutateAsync({ member_id: memberId, tag: newTag.trim() });
    setNewTag("");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input 
          placeholder="Add tag..." 
          value={newTag} 
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
        />
        <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags</p>
        ) : (
          tags.map((tag: any) => (
            <Badge key={tag.id} variant="secondary" className="gap-1">
              {tag.tag}
              <button onClick={() => deleteTag.mutate(tag.id)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

function MemberActivityTimeline({ activities }: { activities: any[] }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'check_in': return <Clock className="h-4 w-4 text-green-600" />;
      case 'class_booking': return <Calendar className="h-4 w-4 text-blue-600" />;
      case 'payment': return <DollarSign className="h-4 w-4 text-emerald-600" />;
      case 'status_change': return <Settings className="h-4 w-4 text-orange-600" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (activities.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No recent activity</p>;
  }

  return (
    <div className="space-y-4">
      {activities.slice(0, 20).map((activity: any) => (
        <div key={activity.id} className="flex gap-3 items-start">
          <div className="mt-0.5">{getActivityIcon(activity.activity_type)}</div>
          <div className="flex-1">
            <p className="text-sm">{activity.description}</p>
            <p className="text-xs text-muted-foreground">
              {activity.created_at ? format(new Date(activity.created_at), 'PPp') : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
