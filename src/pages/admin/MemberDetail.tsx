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
import { ChargeItemSelector } from "@/components/admin/ChargeItemSelector";
import { TierChangeDialog } from "@/components/admin/TierChangeDialog";
import { CreateSubscriptionDialog } from "@/components/admin/CreateSubscriptionDialog";
import { RefundDialog } from "@/components/admin/RefundDialog";
import { InitiationFeeChargeDialog } from "@/components/admin/InitiationFeeChargeDialog";
import { CreateInitiationFeeSubscriptionDialog } from "@/components/admin/CreateInitiationFeeSubscriptionDialog";
import { EditAnnualFeeSubscriptionDialog } from "@/components/admin/EditAnnualFeeSubscriptionDialog";
import { UndoActionDialog } from "@/components/admin/UndoActionDialog";
import { AdminChargeWith3DSProvider } from "@/components/admin/AdminChargeWith3DS";
import { AdminActionButton, ADMIN_ACTION_TOOLTIPS } from "@/components/admin/AdminActionButton";
import { PaymentsTabContent } from "@/components/admin/PaymentsTabContent";
import { BillingHealthCard } from "@/components/admin/BillingHealthCard";
import { ArrearsCard } from "@/components/admin/ArrearsCard";
import { ConfirmedPaymentIssues } from "@/components/admin/MemberDetail/ConfirmedPaymentIssues";
import { MemberArrearsBanner } from "@/components/admin/MemberArrearsBanner";
import { SubscriptionCard } from "@/components/admin/SubscriptionCard";
import { PaymentTimeline } from "@/components/admin/PaymentTimeline";
import { DunningTimeline } from "@/components/admin/DunningTimeline";
import { useMemberArrears } from "@/hooks/useMemberArrears";
import { useMemberNotes, useCreateMemberNote, useUpdateMemberNote, useDeleteMemberNote } from "@/hooks/useMemberNotes";
import { useMemberTags, useCreateMemberTag, useDeleteMemberTag } from "@/hooks/useMemberTags";
import { useMemberActivities } from "@/hooks/useMemberActivities";
import { checkMemberPaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserRoles } from "@/hooks/useUserRoles";
import { EditClassPassDialog } from "@/components/admin/EditClassPassDialog";
import { EditCreditDialog } from "@/components/admin/EditCreditDialog";
import { AdminGrantPassDialog } from "@/components/admin/AdminGrantPassDialog";
import { SellGiftCardDialog } from "@/components/admin/SellGiftCardDialog";
import { useLastUndoableAction } from "@/hooks/useAdminRefunds";
import { useAdminMemberPaymentMethods, useRefreshAdminMemberPaymentMethods } from "@/hooks/useAdminMemberPaymentMethods";
import { useAdminMemberBillingHealth } from "@/hooks/useAdminMemberBillingHealth";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_TYPE_LABELS, CreditType } from "@/lib/memberCredits";
import { getAnnualFeeAmount, normalizeGender } from "@/lib/stripeProducts";
import { getBillingCadenceLabel } from "@/lib/billingTerminology";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, Mail, Phone, Calendar, CreditCard, User, Trash2, DollarSign, 
  FileText, Tag, Activity, BarChart3, Plus, Edit2, X, Settings, 
  AlertCircle, CheckCircle2, ExternalLink, XCircle, Loader2, PlayCircle,
  Clock, Shield, Snowflake, Crown, RefreshCcw, Coins, Minus, ArrowUpCircle, ArrowDownCircle,
  ArrowUpDown, Send, Info, RotateCcw, CalendarClock, Ban, Pencil, Gift
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

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

  // Clear initiation fee state (for incorrect accounting)
  const [showClearInitiationFeeDialog, setShowClearInitiationFeeDialog] = useState(false);
  const [isClearingInitiationFee, setIsClearingInitiationFee] = useState(false);

  // Initiation fee charge state
  const [showInitiationFeeDialog, setShowInitiationFeeDialog] = useState(false);
  const [showCreateInitiationFeeSubDialog, setShowCreateInitiationFeeSubDialog] = useState(false);
  const [showEditAnnualFeeSubDialog, setShowEditAnnualFeeSubDialog] = useState(false);

  // Credit adjustment state
  const [showAdjustCreditDialog, setShowAdjustCreditDialog] = useState(false);
  const [showAdminBookWellnessDialog, setShowAdminBookWellnessDialog] = useState(false);
  const [adminBookServiceType, setAdminBookServiceType] = useState<"red_light" | "dry_cryo" | "class">("red_light");
  const [adminBookDate, setAdminBookDate] = useState<Date | undefined>(undefined);
  const [adminBookTime, setAdminBookTime] = useState("");
  const [adminBookClassSessionId, setAdminBookClassSessionId] = useState<string>("");
  const [adminBookPaymentMethod, setAdminBookPaymentMethod] = useState<"credit" | "pass">("credit");
  const [adminBookPassId, setAdminBookPassId] = useState<string>("");
  const [isAdminBooking, setIsAdminBooking] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [adjustCreditType, setAdjustCreditType] = useState<CreditType>("class");
  const [adjustAmount, setAdjustAmount] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");

  // Tier change state
  const [showTierChangeDialog, setShowTierChangeDialog] = useState(false);

  // Create subscription confirmation dialog state
  const [showCreateSubscriptionDialog, setShowCreateSubscriptionDialog] = useState(false);

  // Activation email state
  const [isSendingActivationEmail, setIsSendingActivationEmail] = useState(false);

  // Edit class pass state
  const [editingPass, setEditingPass] = useState<any>(null);

  // Edit credit state
  const [editingCredit, setEditingCredit] = useState<any>(null);
  const [showGrantDialog, setShowGrantDialog] = useState(false);

  // Cancellation email state
  const [isSendingCancellationEmail, setIsSendingCancellationEmail] = useState(false);

  // Cancel membership state
  const [showCancelMembershipDialog, setShowCancelMembershipDialog] = useState(false);
  const [isCancelingMembership, setIsCancelingMembership] = useState(false);
  const [sendCancelEmail, setSendCancelEmail] = useState(true);

  // Refund and Undo state
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [selectedChargeForRefund, setSelectedChargeForRefund] = useState<{
    id: string;
    amount: number;
    description: string;
    status: string;
    created_at: string;
    stripe_payment_intent_id: string | null;
    charge_type?: string;
  } | null>(null);
  const [showUndoDialog, setShowUndoDialog] = useState(false);

  // 3DS charge state
  const [show3DSDialog, setShow3DSDialog] = useState(false);
  const [pending3DSCharge, setPending3DSCharge] = useState<{
    amount: number;
    description: string;
  } | null>(null);

  // Clear dead subscription state
  const [isClearingDeadSubscription, setIsClearingDeadSubscription] = useState(false);

  // Undo action hook - fetch last undoable action for this member
  const lastUndoableAction = useLastUndoableAction(id);

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
      // Fetch ALL credits (including expired) for admin view, ordered newest first
      const { data, error } = await supabase
        .from("member_credits")
        .select("*")
        .eq("member_id", id)
        .order("cycle_start", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch class passes for this member — query by member_id OR user_id to catch both imported and newly-purchased passes
  const { data: memberClassPasses = [], isLoading: isClassPassesLoading } = useQuery({
    queryKey: ["member-class-passes-admin", id, member?.user_id],
    queryFn: async () => {
      if (!id) return [];
      // Use user_id when available (most reliable), fall back to member_id
      if (member?.user_id) {
        const { data, error } = await supabase
          .from("class_passes")
          .select("*")
          .eq("user_id", member.user_id)
          .order("expires_at", { ascending: true });
        if (error) throw error;
        return data || [];
      }
      // Fallback: query by member_id
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("member_id", id)
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch upcoming class sessions for admin booking (next 14 days)
  const { data: upcomingClassSessions = [] } = useQuery({
    queryKey: ["upcoming-class-sessions-admin"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const twoWeeksOut = format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("class_sessions")
        .select(`
          id, session_date, start_time, end_time, max_capacity, current_enrollment,
          class_type:class_types(name, category)
        `)
        .gte("session_date", today)
        .lte("session_date", twoWeeksOut)
        .eq("is_cancelled", false)
        .order("session_date")
        .order("start_time")
        .limit(50);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        class_type: Array.isArray(s.class_type) ? s.class_type[0] : s.class_type,
      }));
    },
    enabled: showAdminBookWellnessDialog && adminBookServiceType === "class",
  });


  // Fetch guest pass vouchers for this member
  const { data: guestPassVouchers = [], isLoading: isVouchersLoading } = useQuery({
    queryKey: ["member-guest-vouchers", id, member?.user_id],
    queryFn: async () => {
      if (!member?.user_id) return [];
      const { data, error } = await supabase
        .from("guest_passes")
        .select("*")
        .or(`user_id.eq.${member.user_id}${member.email ? `,guest_email.ilike.${member.email}` : ''}`)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!member?.user_id,
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

      let credit = memberCredits.find((c) => c.credit_type === creditType);
      
      // Create a new credit row if none exists and we're adding credits
      if (!credit && adjustment > 0) {
        if (!member) throw new Error("Member data not available");
        
        // user_id is required (NOT NULL) — use member's user_id or fall back to admin's id
        const effectiveUserId = member.user_id || user.id;
        
        const now = new Date();
        const cycleStart = format(now, "yyyy-MM-dd");
        const cycleEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
        const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { data: newCredit, error: insertError } = await supabase
          .from("member_credits")
          .insert({
            user_id: effectiveUserId,
            member_id: id,
            credit_type: creditType,
            credits_total: adjustment,
            credits_remaining: adjustment,
            cycle_start: cycleStart,
            cycle_end: cycleEnd,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Credit insert error:", insertError);
          throw new Error(`Failed to create credit record: ${insertError.message}`);
        }

        // Log the adjustment
        const { error: logError } = await supabase
          .from("credit_adjustments")
          .insert({
            member_id: id,
            member_credit_id: newCredit.id,
            credit_type: creditType,
            adjustment_type: "add",
            amount: adjustment,
            previous_balance: 0,
            new_balance: adjustment,
            reason: reason || null,
            adjusted_by: user.id,
          });

        if (logError) throw logError;

        // Send email notification for guest pass credit only
        if (member.email && creditType === "guest_pass") {
          const expiresDate = format(new Date(expiresAt), "MMMM d, yyyy");
          supabase.functions.invoke("send-email", {
            body: {
              type: "guest_pass_credit_granted",
              to: member.email,
              data: {
                name: member.first_name,
                credits_count: adjustment,
                expires_date: expiresDate,
              },
            },
          }).catch((err: any) => console.error("Failed to send guest pass credit email:", err));
        }

        return { newRemaining: adjustment, creditType };
      }

      if (!credit) {
        throw new Error(`Cannot remove credits: no active ${CREDIT_TYPE_LABELS[creditType]} credits found for this member`);
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

  // Fetch payment methods from Stripe for initiation fee charging
  const { data: stripePaymentMethodsData } = useAdminMemberPaymentMethods(member?.id);
  const stripePaymentMethods = stripePaymentMethodsData?.paymentMethods || [];
  
  // Fetch billing health data to get real Stripe subscription status
  const { data: billingHealth } = useAdminMemberBillingHealth(member?.id);

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
        gender: member.gender || "",
        billing_type: member.billing_type || "monthly",
        membership_start_date: member.membership_start_date || "",
        activated_at: member.activated_at || "",
        is_founding_member: member.is_founding_member || false,
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
          gender: editForm.gender || null,
          billing_type: editForm.billing_type || null,
          membership_start_date: editForm.membership_start_date || null,
          activated_at: editForm.activated_at || null,
          is_founding_member: editForm.is_founding_member,
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
          action: 'charge_saved_card_with_3ds',
          memberId: member.id,
          amount: amountInCents,
          description: chargeDescription.trim(),
        },
      });

      if (error) throw error;
      
      // Check if 3DS is required
      if (data?.requires_action) {
        // Store pending charge info and show 3DS dialog
        setPending3DSCharge({ amount: amountInCents, description: chargeDescription.trim() });
        setShow3DSDialog(true);
        setShowChargeDialog(false);
        return;
      }
      
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

  const handleCreateSubscription = async (startDate: Date, firstChargeDate: Date | null) => {
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
          startDate: startDate.toISOString(),
          firstChargeDate: firstChargeDate ? firstChargeDate.toISOString() : null,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Close the create dialog first, then show success
      setShowCreateSubscriptionDialog(false);
      
      // Show success dialog with details
      const isChargingLater = firstChargeDate && firstChargeDate > new Date();
      setSubscriptionResult({
        ...data,
        tier: normalizeTierDisplay(member.membership_type),
        billingType: getBillingCadenceLabel(member.billing_type, member.is_founding_member),
        price: getPriceDisplay(tier, billingType, gender),
        creditsAllocated: data.creditsAllocated || getCreditsForTier(tier),
        chargedImmediately: !isChargingLater,
        firstChargeDate: firstChargeDate?.toISOString(),
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

  const handleClearDeadSubscription = async () => {
    if (!member) return;
    
    setIsClearingDeadSubscription(true);
    try {
      // Clear the subscription ID from the database
      const { error } = await supabase
        .from('members')
        .update({ 
          stripe_subscription_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', member.id);

      if (error) throw error;

      toast.success("Dead subscription cleared. You can now create a new subscription.");
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-billing-health", id] });
    } catch (error) {
      console.error("Error clearing subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to clear subscription");
    } finally {
      setIsClearingDeadSubscription(false);
    }
  };

  const getCreditsForTier = (tier: string) => {
    // MUST MATCH stripe-payment and stripe-webhook edge functions
    const credits: Record<string, { class: number; red_light: number; dry_cryo: number }> = {
      silver: { class: 0, red_light: 0, dry_cryo: 0 },
      gold: { class: 0, red_light: 4, dry_cryo: 2 },
      platinum: { class: 0, red_light: 6, dry_cryo: 4 },
      diamond: { class: 10, red_light: 10, dry_cryo: 6 },
    };
    return credits[tier?.toLowerCase()] || credits.silver;
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
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error clearing initiation fee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to clear initiation fee status");
    } finally {
      setIsClearingInitiationFee(false);
    }
  };

  const canReactivate = member && ["suspended", "cancelled", "inactive", "frozen", "expired"].includes(member.status);

  // Cancel membership handler - cancels Stripe sub, updates status, optionally sends email, logs action
  const handleCancelMembership = async () => {
    if (!member) return;
    setIsCancelingMembership(true);
    try {
      // 1. Cancel Stripe subscription if exists
      if (member.stripe_subscription_id) {
        const { data, error } = await supabase.functions.invoke('stripe-payment', {
          body: {
            action: 'deactivate_member',
            memberId: member.id,
          },
        });
        if (error) throw error;
        if (data?.error) console.warn("Stripe deactivation warning:", data.error);
      }

      // 2. Update member status to cancelled
      const { error: updateError } = await supabase
        .from("members")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", member.id);
      if (updateError) throw updateError;

      // 3. Log the action for undo support
      if (user) {
        await supabase.from("admin_action_log").insert({
          action_type: "cancel_membership",
          member_id: member.id,
          performed_by: user.id,
          can_undo: true,
          undo_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          action_data: {
            previous_status: member.status,
            had_subscription: !!member.stripe_subscription_id,
            subscription_id: member.stripe_subscription_id,
          },
        });
      }

      // 4. Optionally send cancellation email
      if (sendCancelEmail) {
        await sendCancellationEmail();
      }

      toast.success(`Membership cancelled for ${member.first_name} ${member.last_name}`);
      setShowCancelMembershipDialog(false);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error cancelling membership:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel membership");
    } finally {
      setIsCancelingMembership(false);
    }
  };

  // Send activation email handler
  const sendActivationEmail = async () => {
    if (!member) return;
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
            hasSignedAgreement: false, // Would need to join profiles table
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
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
    } catch (error) {
      console.error("Error sending activation email:", error);
      toast.error("Failed to send activation email");
    } finally {
      setIsSendingActivationEmail(false);
    }
  };

  // Send cancellation email handler - auto-detects which type based on payment state
  const sendCancellationEmail = async () => {
    if (!member) return;
    setIsSendingCancellationEmail(true);
    try {
      // Determine which cancellation email to send based on member payment state
      const isInitiationFeePaid = !!(member.annual_fee_paid_at || member.annual_fee_subscription_id);
      const hadActiveSubscription = !!member.stripe_subscription_id;

      let emailType: string;
      let emailData: Record<string, any>;
      let toastLabel: string;

      if (!isInitiationFeePaid && !hadActiveSubscription) {
        // Never paid anything - application-level cancellation
        emailType = "application_cancelled";
        emailData = { name: member.first_name };
        toastLabel = "Application cancellation";
      } else if (isInitiationFeePaid && !hadActiveSubscription) {
        // Paid initiation fee but never set up dues
        emailType = "incomplete_membership_cancelled";
        emailData = { name: member.first_name };
        toastLabel = "Incomplete membership cancellation";
      } else {
        // Was a fully active member
        emailType = "membership_cancelled";
        emailData = {
          name: member.first_name,
          membershipTier: normalizeTierDisplay(member.membership_type) + " Membership",
          cancellationDate: format(new Date(), "MMMM d, yyyy"),
        };
        toastLabel = "Membership cancellation";
      }

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: emailType,
          to: member.email,
          data: emailData,
        },
      });
      if (error) throw error;

      // Track that cancellation email was sent
      await supabase
        .from("members")
        .update({ cancellation_email_sent_at: new Date().toISOString() } as any)
        .eq("id", member.id);

      toast.success(`${toastLabel} email sent to ${member.first_name}`);
      queryClient.invalidateQueries({ queryKey: ["member", id] });
    } catch (error) {
      console.error("Error sending cancellation email:", error);
      toast.error("Failed to send cancellation email");
    } finally {
      setIsSendingCancellationEmail(false);
    }
  };

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
    <>
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
            <TooltipProvider>
              <div className="flex gap-2 flex-wrap">
                {member.status === "pending_activation" && isSuperAdmin && (
                  <AdminActionButton
                    label="Activate"
                    icon={<PlayCircle className="h-4 w-4 mr-2" />}
                    tooltip={ADMIN_ACTION_TOOLTIPS.activate}
                    onClick={() => setShowActivateDialog(true)}
                  />
                )}
                {canReactivate && (
                  <AdminActionButton
                    label="Reactivate"
                    icon={<RefreshCcw className="h-4 w-4 mr-2" />}
                    variant="outline"
                    tooltip={ADMIN_ACTION_TOOLTIPS.reactivate}
                    onClick={() => setShowReactivateDialog(true)}
                  />
                )}
                <Button variant="outline" onClick={startEditing}>
                  <Edit2 className="h-4 w-4 mr-2" />Edit
                </Button>
                {member.status !== "suspended" && (
                  <AdminActionButton
                    label="Suspend"
                    icon={<XCircle className="h-4 w-4 mr-2" />}
                    variant="outline"
                    tooltip={ADMIN_ACTION_TOOLTIPS.suspend}
                    onClick={() => setShowSuspendDialog(true)}
                  />
                )}
                {member.status !== "cancelled" && (
                  <AdminActionButton
                    label="Cancel Membership"
                    icon={<Ban className="h-4 w-4 mr-2" />}
                    variant="outline"
                    tooltip="Cancel membership, revoke access, and optionally cancel Stripe billing"
                    onClick={() => setShowCancelMembershipDialog(true)}
                  />
                )}
                {isSuperAdmin && (
                  <AdminActionButton
                    label="Delete"
                    icon={<Trash2 className="h-4 w-4 mr-2" />}
                    variant="destructive"
                    tooltip={ADMIN_ACTION_TOOLTIPS.delete}
                    onClick={() => setShowDeleteDialog(true)}
                  />
                )}
                {lastUndoableAction && (
                  <AdminActionButton
                    label="Undo"
                    icon={<RotateCcw className="h-4 w-4 mr-2" />}
                    variant="outline"
                    tooltip="Reverse the last admin action (available for 24 hours)"
                    onClick={() => setShowUndoDialog(true)}
                  />
                )}
                <div className="flex items-center gap-2">
                  <AdminActionButton
                    label={(member as any).cancellation_email_sent_at ? "Resend Cancellation Notice" : "Send Cancellation Notice"}
                    icon={<Mail className="h-4 w-4 mr-2" />}
                    variant="outline"
                    isLoading={isSendingCancellationEmail}
                    tooltip="Sends a branded cancellation confirmation email to the member"
                    onClick={sendCancellationEmail}
                    disabled={!member.email}
                  />
                  {(member as any).cancellation_email_sent_at && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Sent {format(new Date((member as any).cancellation_email_sent_at), "MMM d, yyyy")}
                    </Badge>
                  )}
                </div>
                {(member.status === "active" || member.status === "pending_activation") && (
                  <div className="flex items-center gap-2">
                    <AdminActionButton
                      label={(member as any).activation_email_sent_at ? "Resend Activation Email" : "Send Activation Email"}
                      icon={<Send className="h-4 w-4 mr-2" />}
                      variant="outline"
                      isLoading={isSendingActivationEmail}
                      tooltip={ADMIN_ACTION_TOOLTIPS.sendActivationEmail}
                      onClick={sendActivationEmail}
                      disabled={!member.email}
                    />
                    {(member as any).activation_email_sent_at && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Sent {format(new Date((member as any).activation_email_sent_at), "MMM d, yyyy")}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </TooltipProvider>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Paid</span>
                  </div>
                  {/* Show warning and Create Subscription button if paid but no subscription */}
                  {!member.annual_fee_subscription_id && (
                    <>
                      <div className="flex items-center gap-1.5 text-amber-600 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <span>No recurring subscription</span>
                      </div>
                      {(member.stripe_customer_id && (member.card_brand || stripePaymentMethods.length > 0)) ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowCreateInitiationFeeSubDialog(true)}
                        >
                          <CalendarClock className="h-3 w-3 mr-1" />
                          Create Subscription
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="w-full"
                                disabled
                              >
                                <CalendarClock className="h-3 w-3 mr-1" />
                                Create Subscription
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Add a payment method first</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </>
                  )}
                  {/* Show link to subscription if it exists */}
                  {member.annual_fee_subscription_id && (
                    <div className="flex items-center gap-2">
                      <a 
                        href={getStripeSubscriptionLink(member.annual_fee_subscription_id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View in Stripe <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => setShowEditAnnualFeeSubDialog(true)}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                  {/* Clear Fee Status button - for accounting corrections */}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full mt-2"
                    onClick={() => setShowClearInitiationFeeDialog(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear Fee Status
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Unpaid</span>
                  </div>
                  {(member.stripe_customer_id && (member.card_brand || stripePaymentMethods.length > 0)) ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowInitiationFeeDialog(true)}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Charge ${getAnnualFeeAmount(normalizeGender(member.gender))}
                    </Button>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="w-full"
                            disabled
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Charge Fee
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add a payment method first</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <SubscriptionCard 
            member={member}
            billingHealth={billingHealth}
            isCreatingSubscription={isCreatingSubscription}
            onCreateSubscription={() => setShowCreateSubscriptionDialog(true)}
            onClearDeadSubscription={handleClearDeadSubscription}
            isClearingSubscription={isClearingDeadSubscription}
          />
        </div>

        {/* Activation Status Card - Only for pending_activation members */}
        {member.status === "pending_activation" && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Activation Setup Status
              </CardTitle>
              <CardDescription>
                Member needs to complete these steps before activation on February 9th
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {member.stripe_customer_id ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={member.stripe_customer_id ? "text-foreground" : "text-muted-foreground"}>
                      Account Created
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.card_last4 ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-foreground">
                          Card on File ({member.card_brand} •••• {member.card_last4})
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">Card on File</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">Membership Agreement Signed</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <Button 
                    onClick={sendActivationEmail} 
                    disabled={isSendingActivationEmail}
                    className="w-full sm:w-auto"
                  >
                    {isSendingActivationEmail ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Activation Email
                  </Button>
                  {(member as any).activation_email_sent_at && (
                    <p className="text-xs text-muted-foreground">
                      Last sent: {format(new Date((member as any).activation_email_sent_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Arrears Banner - Always visible above tabs */}
        <MemberArrearsBanner memberId={id!} />

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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Gender</Label>
                          <Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="male">Male</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
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
                        <div>
                          <Label>Membership Type</Label>
                          <Select value={editForm.membership_type} onValueChange={(v) => setEditForm({ ...editForm, membership_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Silver">Silver</SelectItem>
                              <SelectItem value="Gold">Gold</SelectItem>
                              <SelectItem value="Platinum">Platinum</SelectItem>
                              <SelectItem value="Diamond">Diamond</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
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
                        <div>
                          <Label>Membership Start Date</Label>
                          <Input type="date" value={editForm.membership_start_date?.split('T')[0] || ''} onChange={(e) => setEditForm({ ...editForm, membership_start_date: e.target.value })} />
                        </div>
                        <div>
                          <Label>Activated At</Label>
                          <Input type="date" value={editForm.activated_at?.split('T')[0] || ''} onChange={(e) => setEditForm({ ...editForm, activated_at: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <input
                          type="checkbox"
                          id="edit_founding"
                          checked={editForm.is_founding_member}
                          onChange={(e) => setEditForm({ ...editForm, is_founding_member: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="edit_founding">Founding Member</Label>
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
            {/* Arrears Card - Shows outstanding debt */}
            <div className="mb-6">
              <ArrearsCard memberId={member.id} />
            </div>
            {/* Billing Health Card - Full Width at Top */}
            <div className="mb-6">
              <BillingHealthCard 
                memberId={member.id} 
                memberEmail={member.email}
                memberName={`${member.first_name} ${member.last_name}`}
              />
            </div>
            
            {/* Dunning Activity Timeline */}
            <div className="mb-6">
              <DunningTimeline memberId={member.id} />
            </div>

            {/* Payment Timeline - Chronological view of all payment events */}
            <div className="mb-6">
              <PaymentTimeline memberId={member.id} maxItems={50} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Membership Details</CardTitle>
                  <AdminActionButton
                    label="Change Tier"
                    icon={<ArrowUpDown className="h-4 w-4 mr-2" />}
                    variant="outline"
                    tooltip={ADMIN_ACTION_TOOLTIPS.changeTier}
                    onClick={() => setShowTierChangeDialog(true)}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Tier</p>
                      <Badge className={getMembershipColor(member.membership_type)}>
                        {normalizeTierDisplay(member.membership_type)}
                      </Badge>
                    </div>
                    {/* Pending Tier Change Banner */}
                    {(member as Record<string, unknown>).pending_tier_change && (
                      <div className="col-span-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <div>
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                Pending downgrade to {String((member as Record<string, unknown>).pending_tier_change)}
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Scheduled {(member as Record<string, unknown>).pending_tier_change_at ? format(new Date(String((member as Record<string, unknown>).pending_tier_change_at)), 'PPP') : ''} · Will apply at next billing cycle
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/50"
                            onClick={async () => {
                              const { error } = await supabase
                                .from("members")
                                .update({
                                  pending_tier_change: null,
                                  pending_tier_change_at: null,
                                  pending_tier_change_by: null,
                                } as Record<string, unknown>)
                                .eq("id", member.id);
                              if (error) {
                                toast.error("Failed to cancel pending change");
                              } else {
                                toast.success("Pending tier change cancelled");
                                queryClient.invalidateQueries({ queryKey: ["admin-member-detail", member.id] });
                              }
                            }}
                          >
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    )}
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
                        <AdminActionButton
                          label="Cancel"
                          variant="destructive"
                          tooltip={ADMIN_ACTION_TOOLTIPS.cancelAnnualFee}
                          onClick={() => setShowCancelAnnualFeeDialog(true)}
                        />
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
              <ConfirmedPaymentIssues memberId={member.id} />
              <PaymentsTabContent 
                member={member}
                onAddCard={handleAddCard}
                isCreatingSetupIntent={isCreatingSetupIntent}
                onChargeCard={() => setShowChargeDialog(true)}
                onRefundClick={(charge) => {
                  setSelectedChargeForRefund(charge);
                  setShowRefundDialog(true);
                }}
              />
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
                      {isSuperAdmin() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowGrantDialog(true)}
                        >
                          <Gift className="h-4 w-4 mr-1" />Grant
                        </Button>
                      )}
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
                      <Button 
                        size="sm"
                        onClick={() => setShowAdminBookWellnessDialog(true)}
                      >
                        <CalendarClock className="h-4 w-4 mr-1" />Book Session
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isCreditsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Current Monthly Credits - latest non-expired per type */}
                      <h4 className="text-sm font-semibold mb-3 text-foreground">Current Monthly Credits</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(['class', 'red_light', 'dry_cryo', 'guest_pass'] as CreditType[]).map((type) => {
                          const now = new Date().toISOString();
                          // Pick latest non-expired credit for this type (already sorted by cycle_start DESC)
                          const credit = memberCredits.find((c) => c.credit_type === type && c.expires_at > now);
                          return (
                            <div key={type} className={`p-4 border rounded-lg ${credit && credit.credits_remaining > 0 ? 'border-primary/30 bg-primary/5' : ''}`}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm text-muted-foreground">{CREDIT_TYPE_LABELS[type]}</p>
                                {credit && isSuperAdmin() && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingCredit(credit)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              {credit ? (
                                <>
                                  <p className="text-2xl font-bold">
                                    {credit.credits_remaining}
                                    <span className="text-sm font-normal text-muted-foreground">/{credit.credits_total}</span>
                                  </p>
                                  <Progress
                                    value={(credit.credits_remaining / credit.credits_total) * 100}
                                    className="h-1.5 mt-2 mb-1"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Cycle: {credit.cycle_start ? format(new Date(credit.cycle_start), 'MMM d') : '—'} – {credit.cycle_end ? format(new Date(credit.cycle_end), 'MMM d') : '—'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Expires {format(new Date(credit.expires_at), 'MMM d, yyyy')}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-2xl font-bold text-muted-foreground">0</p>
                                  <p className="text-xs text-muted-foreground mt-1">No active credits</p>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Expired/Historical Credits - only visible to super admins */}
                      {isSuperAdmin() && (() => {
                        const now = new Date().toISOString();
                        const expiredCredits = memberCredits.filter((c) => c.expires_at <= now);
                        if (expiredCredits.length === 0) return null;
                        return (
                          <Collapsible className="mt-6">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
                                <Clock className="h-4 w-4" />
                                Expired/Historical Credits ({expiredCredits.length})
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-3 space-y-2">
                                {expiredCredits.map((credit) => (
                                  <div key={credit.id} className="flex items-center justify-between p-3 border rounded-lg opacity-70">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{CREDIT_TYPE_LABELS[credit.credit_type as CreditType] || credit.credit_type}</p>
                                        <Badge variant="secondary" className="text-xs">Expired</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {credit.credits_remaining}/{credit.credits_total} remaining · 
                                        Cycle: {credit.cycle_start ? format(new Date(credit.cycle_start), 'MMM d') : '—'} – {credit.cycle_end ? format(new Date(credit.cycle_end), 'MMM d, yyyy') : '—'} ·
                                        Expired {format(new Date(credit.expires_at), 'MMM d, yyyy')}
                                      </p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setEditingCredit(credit)}>
                                      <Pencil className="h-3.5 w-3.5 mr-1" />Extend
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Class Passes */}
              <Card>
                <CardHeader>
                  <CardTitle>Class Passes</CardTitle>
                  <CardDescription>Purchased class passes for this member</CardDescription>
                </CardHeader>
                <CardContent>
                  {isClassPassesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : memberClassPasses.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">No class passes</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {memberClassPasses.map((pass: any) => {
                        const isActive = pass.status === 'active' && pass.classes_remaining > 0 && new Date(pass.expires_at) > new Date();
                        return (
                          <div key={pass.id} className={`p-4 border rounded-lg ${isActive ? 'border-primary/30' : 'opacity-60'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm">{pass.pass_type}</p>
                              <div className="flex items-center gap-1">
                                {isSuperAdmin() && (
                                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingPass(pass)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                                  {isActive ? 'Active' : pass.status}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground capitalize mb-2">Category: {pass.category?.replace(/_/g, ' ')}</p>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Classes remaining</span>
                              <span className="font-semibold">{pass.classes_remaining}/{pass.classes_total}</span>
                            </div>
                            <Progress value={(pass.classes_remaining / pass.classes_total) * 100} className="h-1.5 mb-2" />
                            <p className="text-xs text-muted-foreground">
                              Expires {format(new Date(pass.expires_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Guest Pass Vouchers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Guest Pass Vouchers
                  </CardTitle>
                  <CardDescription>Voucher-type guest passes granted to this member</CardDescription>
                </CardHeader>
                <CardContent>
                  {isVouchersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : guestPassVouchers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">No guest pass vouchers</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {guestPassVouchers.map((voucher: any) => {
                        const now = new Date();
                        const isUsed = voucher.status === 'used';
                        const isExpired = !isUsed && voucher.expires_at && new Date(voucher.expires_at) < now;
                        const isActive = !isUsed && !isExpired && (voucher.status === 'active' || voucher.status === 'purchased');
                        return (
                          <div key={voucher.id} className={`p-4 border rounded-lg ${isActive ? 'border-primary/30 bg-primary/5' : 'opacity-60'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm">Guest Pass Voucher</p>
                              <Badge
                                variant={isActive ? "default" : "secondary"}
                                className={
                                  isUsed
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
                                    : isExpired
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                    : ""
                                }
                              >
                                {isUsed ? "Used" : isExpired ? "Expired" : "Active"}
                              </Badge>
                            </div>
                            {voucher.guest_name && (
                              <p className="text-sm"><span className="text-muted-foreground">Guest:</span> {voucher.guest_name}</p>
                            )}
                            {voucher.guest_email && (
                              <p className="text-xs text-muted-foreground">{voucher.guest_email}</p>
                            )}
                            {voucher.expires_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Expires {format(new Date(voucher.expires_at), 'MMM d, yyyy')}
                              </p>
                            )}
                            {voucher.used_at && (
                              <p className="text-xs text-muted-foreground">
                                Used {format(new Date(voucher.used_at), 'MMM d, yyyy')}
                              </p>
                            )}
                            {voucher.valid_date && (
                              <p className="text-xs text-muted-foreground">
                                Valid for {format(new Date(voucher.valid_date), 'MMM d, yyyy')}
                              </p>
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
                  <SelectItem value="guest_pass">Complimentary Guest Pass</SelectItem>
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

      {/* Admin Book Session Dialog — supports Wellness + Class bookings */}
      <Dialog open={showAdminBookWellnessDialog} onOpenChange={(open) => {
        setShowAdminBookWellnessDialog(open);
        if (!open) {
          setAdminBookDate(undefined);
          setAdminBookTime("");
          setAdminBookClassSessionId("");
          setAdminBookPaymentMethod("credit");
          setAdminBookPassId("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book Session for {member?.first_name}</DialogTitle>
            <DialogDescription>
              Book a session using this member's credits or class passes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Service Type */}
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={adminBookServiceType} onValueChange={(v: "red_light" | "dry_cryo" | "class") => {
                setAdminBookServiceType(v);
                setAdminBookClassSessionId("");
                setAdminBookPaymentMethod("credit");
                setAdminBookPassId("");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="red_light">Red Light Therapy</SelectItem>
                  <SelectItem value="dry_cryo">Dry Cryotherapy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Class booking: payment method selector + session picker */}
            {adminBookServiceType === "class" ? (
              <>
                {/* Payment method: credit or pass */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  {(() => {
                    const now = new Date().toISOString();
                    const classCredit = memberCredits.find(c => c.credit_type === "class" && c.credits_remaining > 0 && c.expires_at > now);
                    const activePasses = memberClassPasses.filter((p: any) => p.status === 'active' && p.classes_remaining > 0 && new Date(p.expires_at) > new Date());
                    const hasCredits = !!classCredit;
                    const hasPasses = activePasses.length > 0;
                    if (!hasCredits && !hasPasses) {
                      return <p className="text-xs text-destructive py-2">No active class credits or passes found for this member.</p>;
                    }
                    return (
                      <div className="space-y-2">
                        {hasCredits && (
                          <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${adminBookPaymentMethod === 'credit' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                            <input type="radio" className="mt-0.5" checked={adminBookPaymentMethod === 'credit'} onChange={() => { setAdminBookPaymentMethod('credit'); setAdminBookPassId(''); }} />
                            <div>
                              <p className="font-medium text-sm">Use Class Credit</p>
                              <p className="text-xs text-muted-foreground">{classCredit!.credits_remaining} of {classCredit!.credits_total} remaining · expires {format(new Date(classCredit!.expires_at), 'MMM d, yyyy')}</p>
                            </div>
                          </label>
                        )}
                        {activePasses.map((pass: any) => (
                          <label key={pass.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${adminBookPaymentMethod === 'pass' && adminBookPassId === pass.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                            <input type="radio" className="mt-0.5" checked={adminBookPaymentMethod === 'pass' && adminBookPassId === pass.id} onChange={() => { setAdminBookPaymentMethod('pass'); setAdminBookPassId(pass.id); }} />
                            <div>
                              <p className="font-medium text-sm">{pass.pass_type} <span className="text-xs text-muted-foreground capitalize">({pass.category?.replace(/_/g, ' ')})</span></p>
                              <p className="text-xs text-muted-foreground">{pass.classes_remaining} of {pass.classes_total} classes remaining · expires {format(new Date(pass.expires_at), 'MMM d, yyyy')}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Class session picker */}
                <div className="space-y-2">
                  <Label>Select Class Session</Label>
                  <Select value={adminBookClassSessionId} onValueChange={setAdminBookClassSessionId}>
                    <SelectTrigger><SelectValue placeholder="Choose an upcoming session..." /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {upcomingClassSessions.length === 0 ? (
                        <SelectItem value="none" disabled>No upcoming sessions available</SelectItem>
                      ) : (
                        upcomingClassSessions.map((session: any) => {
                          const isFull = session.current_enrollment >= session.max_capacity;
                          const h = parseInt(session.start_time?.split(":")[0] || "0");
                          const m = session.start_time?.split(":")[1] || "00";
                          const ampm = h >= 12 ? "PM" : "AM";
                          const h12 = h % 12 || 12;
                          return (
                            <SelectItem key={session.id} value={session.id} disabled={isFull}>
                              {format(new Date(session.session_date + "T12:00:00"), "EEE MMM d")} — {session.class_type?.name} @ {h12}:{m} {ampm}
                              {isFull ? " (FULL)" : ` (${session.current_enrollment}/${session.max_capacity})`}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {/* Wellness credit info */}
                {(() => {
                  const nowStr = new Date().toISOString();
                  const credit = memberCredits.find(c => c.credit_type === adminBookServiceType && c.credits_remaining > 0 && c.expires_at > nowStr);
                  return credit ? (
                    <p className="text-xs text-muted-foreground">{credit.credits_remaining} of {credit.credits_total} credits remaining</p>
                  ) : (
                    <p className="text-xs text-destructive">No active credits for this service</p>
                  );
                })()}
                {/* Date picker for wellness */}
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !adminBookDate && "text-muted-foreground")}>
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {adminBookDate ? format(adminBookDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker mode="single" selected={adminBookDate} onSelect={(d) => setAdminBookDate(d || undefined)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select value={adminBookTime} onValueChange={setAdminBookTime}>
                    <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                    <SelectContent>
                      {["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"].map(t => {
                        const h = parseInt(t.split(":")[0]); const m = t.split(":")[1];
                        const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
                        return <SelectItem key={t} value={t}>{h12}:{m} {ampm}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdminBookWellnessDialog(false)}>Cancel</Button>
            <Button
              disabled={
                isAdminBooking ||
                (adminBookServiceType === "class"
                  ? !adminBookClassSessionId || (
                      adminBookPaymentMethod === "credit"
                        ? !memberCredits.find(c => c.credit_type === "class" && c.credits_remaining > 0 && c.expires_at > new Date().toISOString())
                        : !adminBookPassId
                    )
                  : !adminBookDate || !adminBookTime || !memberCredits.find(c => c.credit_type === adminBookServiceType && c.credits_remaining > 0 && c.expires_at > new Date().toISOString()))
              }
              onClick={async () => {
                if (!member) return;
                setIsAdminBooking(true);
                try {
                  if (adminBookServiceType === "class") {
                    if (!member.user_id) throw new Error("Member has no linked user account");
                    
                    if (adminBookPaymentMethod === "pass") {
                      // Book using class pass
                      if (!adminBookPassId) throw new Error("No class pass selected");
                      const { data, error } = await supabase.rpc("create_atomic_class_booking" as any, {
                        _session_id: adminBookClassSessionId,
                        _user_id: member.user_id,
                        _payment_method: "pass",
                        _pass_id: adminBookPassId,
                      });
                      if (error) throw error;
                      const result = data as any;
                      if (!result?.success) throw new Error(result?.error || "Booking failed");
                      toast.success(`Class booked for ${member.first_name} using 1 class pass`);
                      queryClient.invalidateQueries({ queryKey: ["member-class-passes-admin", id, member.user_id] });
                    } else {
                      // Book using class credits
                      const credit = memberCredits.find(c => c.credit_type === "class" && c.credits_remaining > 0 && c.expires_at > new Date().toISOString());
                      if (!credit) throw new Error("No class credits available");
                      const { data, error } = await supabase.rpc("create_atomic_class_booking" as any, {
                        _session_id: adminBookClassSessionId,
                        _user_id: member.user_id,
                        _payment_method: "credits",
                        _member_credit_id: credit.id,
                      });
                      if (error) throw error;
                      const result = data as any;
                      if (!result?.success) throw new Error(result?.error || "Booking failed");
                      toast.success(`Class booked for ${member.first_name} using 1 class credit`);
                      queryClient.invalidateQueries({ queryKey: ["member-credits", id] });
                    }
                    queryClient.invalidateQueries({ queryKey: ["member-credit-usage", id] });
                  } else {
                    // Book wellness session via atomic RPC
                    if (!adminBookDate || !adminBookTime) return;
                    const { data: rpcResult, error: rpcError } = await supabase.rpc(
                      'staff_book_wellness_appointment' as any,
                      {
                        p_member_id: member.id,
                        p_credit_type: adminBookServiceType,
                        p_appointment_date: format(adminBookDate, "yyyy-MM-dd"),
                        p_appointment_time: adminBookTime,
                        p_staff_notes: "Booked by staff",
                      }
                    );
                    if (rpcError) throw new Error(rpcError.message);
                    const wellnessResult = rpcResult as any;
                    if (!wellnessResult?.success) throw new Error(wellnessResult?.error || "Booking failed");
                    toast.success(`${wellnessResult.service_name} booked for ${member.first_name} on ${format(adminBookDate, "MMM d")} using 1 credit`);
                    queryClient.invalidateQueries({ queryKey: ["member-credits", id] });
                  }
                  setShowAdminBookWellnessDialog(false);
                  setAdminBookDate(undefined);
                  setAdminBookTime("");
                  setAdminBookClassSessionId("");
                  setAdminBookPaymentMethod("credit");
                  setAdminBookPassId("");
                } catch (error: any) {
                  toast.error(error.message || "Failed to book session");
                } finally {
                  setIsAdminBooking(false);
                }
              }}
            >
              {isAdminBooking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Book Session
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

      {/* Charge Card Dialog - Enhanced with Item Selector */}
      <ChargeItemSelector
        open={showChargeDialog}
        onOpenChange={setShowChargeDialog}
        member={member}
        onChargeSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
        }}
        onRequires3DS={(amount, description) => {
          setPending3DSCharge({ amount, description });
          setShow3DSDialog(true);
        }}
      />

      {/* Create Subscription Confirmation Dialog */}
      <CreateSubscriptionDialog
        open={showCreateSubscriptionDialog}
        onOpenChange={setShowCreateSubscriptionDialog}
        member={member}
        isLoading={isCreatingSubscription}
        onConfirm={handleCreateSubscription}
      />

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

      {/* Tier Change Dialog */}
      <TierChangeDialog
        open={showTierChangeDialog}
        onOpenChange={setShowTierChangeDialog}
        memberId={member.id}
        currentTier={member.membership_type}
        memberGender={member.gender || 'female'}
        billingType={member.billing_type || 'monthly'}
        hasActiveSubscription={!!member.stripe_subscription_id}
        hasAnnualFeePaid={!!member.annual_fee_paid_at}
        isFoundingMember={!!member.is_founding_member}
      />

      {/* Refund Dialog */}
      <RefundDialog
        open={showRefundDialog}
        onOpenChange={setShowRefundDialog}
        charge={selectedChargeForRefund}
        memberId={member.id}
        memberName={`${member.first_name} ${member.last_name}`}
      />

      {/* Undo Action Dialog */}
      <UndoActionDialog
        open={showUndoDialog}
        onOpenChange={setShowUndoDialog}
        action={lastUndoableAction}
        memberId={member.id}
        memberName={`${member.first_name} ${member.last_name}`}
      />

      {/* Initiation Fee Charge Dialog */}
      <InitiationFeeChargeDialog
        open={showInitiationFeeDialog}
        onOpenChange={setShowInitiationFeeDialog}
        member={member}
        paymentMethod={stripePaymentMethods[0] || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
        }}
      />

      {/* Create Initiation Fee Subscription Dialog (for already-paid members) */}
      <CreateInitiationFeeSubscriptionDialog
        open={showCreateInitiationFeeSubDialog}
        onOpenChange={setShowCreateInitiationFeeSubDialog}
        member={member}
        paymentMethod={stripePaymentMethods[0] || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
        }}
      />

      {/* Edit Annual Fee Subscription Dialog */}
      <EditAnnualFeeSubscriptionDialog
        open={showEditAnnualFeeSubDialog}
        onOpenChange={setShowEditAnnualFeeSubDialog}
        member={member}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-member-detail", id] });
        }}
      />

      {/* Clear Initiation Fee Confirmation Dialog */}
      <AlertDialog open={showClearInitiationFeeDialog} onOpenChange={setShowClearInitiationFeeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Initiation Fee Status</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the initiation fee payment status for {member.first_name} {member.last_name}. 
              <br /><br />
              <strong>This action:</strong>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                <li>Removes the "paid" status from their record</li>
                <li>Does NOT issue a refund (do that separately if needed)</li>
                <li>The member will need to pay the fee again to regain benefits</li>
              </ul>
              <br />
              Use this only if the payment was incorrectly recorded or needs accounting correction.
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

      {/* Cancel Membership Confirmation Dialog */}
      <AlertDialog open={showCancelMembershipDialog} onOpenChange={setShowCancelMembershipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Membership</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Are you sure you want to cancel the membership for <strong>{member.first_name} {member.last_name}</strong>?</p>
                <ul className="list-disc pl-4 mt-3 space-y-1 text-sm">
                  <li>Member status will be set to <strong>cancelled</strong></li>
                  <li>Club access will be revoked immediately</li>
                  {member.stripe_subscription_id && (
                    <li>Stripe subscription will be cancelled</li>
                  )}
                </ul>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Checkbox
                    id="send-cancel-email"
                    checked={sendCancelEmail}
                    onCheckedChange={(checked) => setSendCancelEmail(checked === true)}
                  />
                  <label htmlFor="send-cancel-email" className="text-sm cursor-pointer">
                    Send cancellation notice email
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelingMembership}>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelMembership}
              disabled={isCancelingMembership}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isCancelingMembership && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Membership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>

    {editingPass && (
      <EditClassPassDialog
        open={!!editingPass}
        onOpenChange={(open) => { if (!open) setEditingPass(null); }}
        pass={editingPass}
        queryKeysToInvalidate={[["member-class-passes-admin", id]]}
      />
    )}

    {editingCredit && (
      <EditCreditDialog
        open={!!editingCredit}
        onOpenChange={(open) => { if (!open) setEditingCredit(null); }}
        credit={editingCredit}
        queryKeysToInvalidate={[["member-credits", id]]}
      />
    )}

    {showGrantDialog && member && (
      <AdminGrantPassDialog
        open={showGrantDialog}
        onOpenChange={setShowGrantDialog}
        prefill={{
          memberId: member.id,
          userId: member.user_id || undefined,
          name: `${member.first_name} ${member.last_name}`,
          email: member.email,
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["member-credits", id] });
          queryClient.invalidateQueries({ queryKey: ["member-class-passes-admin", id] });
        }}
      />
    )}
    </>
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
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={deleteNote.isPending}
                onClick={() => {
                  if (confirm("Delete this note?")) {
                    deleteNote.mutate({ id: note.id, memberId });
                  }
                }}
              >
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
