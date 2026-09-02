import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Search, MoreHorizontal, UserPlus, Mail, Loader2, AlertTriangle, DollarSign, ShoppingBag, CheckCircle2, Send, FileCheck, X, Users, CreditCard, Clock, XCircle } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMembersBillingIssues } from "@/hooks/useMembersBillingIssues";
import { MemberIssuesBadges } from "@/components/admin/MemberIssuesBadges";
import { MemberArrearsIndicator } from "@/components/admin/MemberArrearsIndicator";
import { EffectiveStatusBadge } from "@/components/admin/EffectiveStatusBadge";
import { Switch } from "@/components/ui/switch";

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

// Extract tier for filtering
const extractTier = (membership: string): string => {
  const lower = membership?.toLowerCase() || "";
  if (lower.includes("diamond")) return "diamond";
  if (lower.includes("platinum")) return "platinum";
  if (lower.includes("gold")) return "gold";
  if (lower.includes("silver")) return "silver";
  return "other";
};

export default function Members() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useUserRoles();
  const { data: billingIssues } = useMembersBillingIssues();
  
  // URL-persisted filter state
  const searchQuery = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "active_default";
  const tierFilter = searchParams.get("tier") || "all";
  const initiationFilter = searchParams.get("initiation") || "all";
  const cardFilter = searchParams.get("card") || "all";
  const subscriptionFilter = searchParams.get("subscription") || "all";
  const genderFilter = searchParams.get("gender") || "all";
  const waiverFilter = searchParams.get("waiver") || "all";
  const foundingFilter = searchParams.get("founding") || "all";
  const billingTypeFilter = searchParams.get("billing") || "all";
  const showCancelled = searchParams.get("showCancelled") === "true";
  const issuesOnly = searchParams.get("issues") === "true";
  
  // Helper to update URL params
  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === null || value === "" || value === "all" || (key === "status" && value === "active_default") || (key === "showCancelled" && value === "false") || (key === "issues" && value === "false")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params, { replace: true });
  };

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    const params = new URLSearchParams();
    switch (preset) {
      case "active":
        params.set("status", "active");
        break;
      case "pending":
        params.set("status", "pending_activation");
        break;
      case "needs_attention":
        params.set("issues", "true");
        break;
      case "initiation_unpaid":
        params.set("initiation", "unpaid");
        break;
      case "no_card":
        params.set("card", "no");
        break;
      case "no_subscription":
        params.set("subscription", "none");
        break;
      case "all":
        params.set("showCancelled", "true");
        params.set("status", "all");
        break;
    }
    setSearchParams(params, { replace: true });
  };

  const clearAllFilters = () => {
    setSearchParams({}, { replace: true });
  };
  
  // Local state for dialogs and actions
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [showClassPackageDialog, setShowClassPackageDialog] = useState(false);
  const [memberToActivate, setMemberToActivate] = useState<any | null>(null);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSendingActivationEmail, setIsSendingActivationEmail] = useState(false);
  const [isSendingBulkEmails, setIsSendingBulkEmails] = useState(false);
  const [isSendingWaiverReminder, setIsSendingWaiverReminder] = useState(false);
  const [isSendingBulkWaiverReminders, setIsSendingBulkWaiverReminders] = useState(false);

  // Fetch members with their waiver status from profiles
  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data: membersData, error: membersError } = await supabase
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
          activation_email_sent_at,
          cancellation_email_sent_at,
          records_cancelled_at
        `)
        .is("records_cancelled_at", null)
        .order("created_at", { ascending: false });

      if (membersError) throw membersError;

      const userIds = membersData.filter(m => m.user_id).map(m => m.user_id);
      let profilesMap: Record<string, { waiver_signed: boolean; membership_agreement_signed: boolean }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, waiver_signed, membership_agreement_signed")
          .in("id", userIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.id] = { 
              waiver_signed: p.waiver_signed || false, 
              membership_agreement_signed: p.membership_agreement_signed || false 
            };
            return acc;
          }, {} as Record<string, { waiver_signed: boolean; membership_agreement_signed: boolean }>);
        }
      }

      return membersData.map(m => ({
        ...m,
        waiver_signed: m.user_id ? profilesMap[m.user_id]?.waiver_signed || false : false,
        membership_agreement_signed: m.user_id ? profilesMap[m.user_id]?.membership_agreement_signed || false : false,
      }));
    },
  });

  // Batch-fetch next billing dates from Stripe for all members with subscriptions
  const subscriptionIds = useMemo(() => {
    return members
      .filter((m: any) => m.stripe_subscription_id)
      .map((m: any) => m.stripe_subscription_id as string);
  }, [members]);

  const { data: billingDates } = useQuery<Record<string, string>>({
    queryKey: ["admin-members-billing-dates", subscriptionIds],
    queryFn: async () => {
      if (subscriptionIds.length === 0) return {};
      const { data, error } = await supabase.functions.invoke("get-autopay-dates", {
        body: { subscription_ids: subscriptionIds },
      });
      if (error) throw error;
      return (data as Record<string, string>) || {};
    },
    enabled: subscriptionIds.length > 0,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  // Calculate filter counts
  const filterCounts = useMemo<{
    total: number;
    active: number;
    pending_activation: number;
    frozen: number;
    cancelled: number;
    expired: number;
    suspended: number;
    past_due: number;
    initiationPaid: number;
    initiationUnpaid: number;
    hasCard: number;
    noCard: number;
    hasSubscription: number;
    noSubscription: number;
    waiverSigned: number;
    waiverUnsigned: number;
    women: number;
    men: number;
    founding: number;
    issues: number;
  }>(() => {
    const counts = {
      total: members.length,
      active: 0,
      pending_activation: 0,
      frozen: 0,
      cancelled: 0,
      expired: 0,
      suspended: 0,
      past_due: 0,
      initiationPaid: 0,
      initiationUnpaid: 0,
      hasCard: 0,
      noCard: 0,
      hasSubscription: 0,
      noSubscription: 0,
      waiverSigned: 0,
      waiverUnsigned: 0,
      women: 0,
      men: 0,
      founding: 0,
      issues: 0,
    };

    for (const member of members) {
      // Status counts
      const status = member.status?.toLowerCase() || "";
      if (status === "active") counts.active++;
      else if (status === "pending_activation") counts.pending_activation++;
      else if (status === "frozen") counts.frozen++;
      else if (status === "cancelled") counts.cancelled++;
      else if (status === "expired") counts.expired++;
      else if (status === "suspended") counts.suspended++;
      else if (status === "past_due") counts.past_due++;

      // Skip cancelled/expired members for billing-related counts
      const isTerminated = status === "cancelled" || status === "expired";

      // Initiation fee
      if (member.annual_fee_paid_at || member.annual_fee_subscription_id) {
        counts.initiationPaid++;
      } else if (!isTerminated) {
        counts.initiationUnpaid++;
      }

      // Card
      if (member.card_last4) {
        counts.hasCard++;
      } else if (!isTerminated) {
        counts.noCard++;
      }

      // Subscription
      if (member.stripe_subscription_id) {
        counts.hasSubscription++;
      } else if (!isTerminated) {
        counts.noSubscription++;
      }

      // Waiver
      if (member.waiver_signed && member.membership_agreement_signed) {
        counts.waiverSigned++;
      } else {
        counts.waiverUnsigned++;
      }

      // Gender
      const gender = member.gender?.toLowerCase() || "";
      if (gender === "female" || gender === "woman") counts.women++;
      else if (gender === "male" || gender === "man") counts.men++;

      // Founding
      if (member.is_founding_member) counts.founding++;

      // Issues
      if (billingIssues?.memberIssues?.[member.id]?.length > 0) {
        counts.issues++;
      }
    }

    return counts;
  }, [members, billingIssues]);

  // Apply all filters
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = 
          member.first_name?.toLowerCase().includes(q) ||
          member.last_name?.toLowerCase().includes(q) ||
          member.email?.toLowerCase().includes(q) ||
          member.member_id?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Status filter
      const memberStatus = member.status?.toLowerCase() || "";
      if (statusFilter === "active_default") {
        // Default: exclude cancelled and expired
        if (!showCancelled && (memberStatus === "cancelled" || memberStatus === "expired")) {
          return false;
        }
      } else if (statusFilter !== "all") {
        if (memberStatus !== statusFilter) return false;
      } else {
        // "all" status - still respect showCancelled toggle
        if (!showCancelled && (memberStatus === "cancelled" || memberStatus === "expired")) {
          return false;
        }
      }

      // Tier filter
      if (tierFilter !== "all") {
        const memberTier = extractTier(member.membership_type);
        if (memberTier !== tierFilter) return false;
      }

      // Initiation fee filter
      if (initiationFilter !== "all") {
        const hasPaid = !!(member.annual_fee_paid_at || member.annual_fee_subscription_id);
        if (initiationFilter === "paid" && !hasPaid) return false;
        if (initiationFilter === "unpaid" && hasPaid) return false;
      }

      // Card filter
      if (cardFilter !== "all") {
        const hasCard = !!member.card_last4;
        if (cardFilter === "yes" && !hasCard) return false;
        if (cardFilter === "no" && hasCard) return false;
        if (cardFilter === "expiring") {
          // Show members with cards expiring within 2 months
          if (!member.card_exp_month || !member.card_exp_year) return false;
          const now = new Date();
          const monthsUntil = (member.card_exp_year - now.getFullYear()) * 12 + (member.card_exp_month - (now.getMonth() + 1));
          if (monthsUntil <= 0 || monthsUntil > 2) return false;
        }
        if (cardFilter === "expired") {
          if (!member.card_exp_month || !member.card_exp_year) return false;
          const now = new Date();
          const monthsUntil = (member.card_exp_year - now.getFullYear()) * 12 + (member.card_exp_month - (now.getMonth() + 1));
          if (monthsUntil > 0) return false;
        }
        if (cardFilter === "not_synced") {
          if (member.card_last4 || !member.stripe_customer_id) return false;
        }
      }

      // Subscription filter
      if (subscriptionFilter !== "all") {
        const hasSub = !!member.stripe_subscription_id;
        if (subscriptionFilter === "active" && !hasSub) return false;
        if (subscriptionFilter === "none" && hasSub) return false;
      }

      // Gender filter
      if (genderFilter !== "all") {
        const gender = member.gender?.toLowerCase() || "";
        if (genderFilter === "women" && gender !== "female" && gender !== "woman") return false;
        if (genderFilter === "men" && gender !== "male" && gender !== "man") return false;
      }

      // Waiver filter
      if (waiverFilter !== "all") {
        const signed = member.waiver_signed && member.membership_agreement_signed;
        if (waiverFilter === "signed" && !signed) return false;
        if (waiverFilter === "unsigned" && signed) return false;
      }

      // Founding member filter
      if (foundingFilter !== "all") {
        if (foundingFilter === "founding" && !member.is_founding_member) return false;
        if (foundingFilter === "regular" && member.is_founding_member) return false;
      }

      // Billing type filter
      if (billingTypeFilter !== "all") {
        const billing = member.billing_type || "monthly";
        if (billingTypeFilter !== billing) return false;
      }

      // Issues only filter
      if (issuesOnly) {
        const hasIssues = billingIssues?.memberIssues?.[member.id]?.length > 0;
        if (!hasIssues) return false;
      }

      return true;
    });
  }, [members, searchQuery, statusFilter, tierFilter, initiationFilter, cardFilter, subscriptionFilter, genderFilter, waiverFilter, foundingFilter, billingTypeFilter, showCancelled, issuesOnly, billingIssues]);

  // Get active filter count for display
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "active_default") count++;
    if (tierFilter !== "all") count++;
    if (initiationFilter !== "all") count++;
    if (cardFilter !== "all") count++;
    if (subscriptionFilter !== "all") count++;
    if (genderFilter !== "all") count++;
    if (waiverFilter !== "all") count++;
    if (foundingFilter !== "all") count++;
    if (billingTypeFilter !== "all") count++;
    if (showCancelled) count++;
    if (issuesOnly) count++;
    if (searchQuery) count++;
    return count;
  }, [statusFilter, tierFilter, initiationFilter, cardFilter, subscriptionFilter, genderFilter, waiverFilter, foundingFilter, billingTypeFilter, showCancelled, issuesOnly, searchQuery]);

  // Active filter pills for display
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];
    if (searchQuery) filters.push({ key: "q", label: `Search: "${searchQuery}"` });
    if (statusFilter !== "active_default") {
      filters.push({ key: "status", label: `Status: ${statusFilter.replace(/_/g, " ")}` });
    }
    if (tierFilter !== "all") filters.push({ key: "tier", label: `Tier: ${tierFilter}` });
    if (initiationFilter !== "all") filters.push({ key: "initiation", label: `Initiation: ${initiationFilter}` });
    if (cardFilter !== "all") {
      const cardLabels: Record<string, string> = { yes: "Has Card", no: "No Card", expiring: "Expiring Card", expired: "Expired Card", not_synced: "Not Synced" };
      filters.push({ key: "card", label: `Card: ${cardLabels[cardFilter] || cardFilter}` });
    }
    if (subscriptionFilter !== "all") filters.push({ key: "subscription", label: `Subscription: ${subscriptionFilter}` });
    if (genderFilter !== "all") filters.push({ key: "gender", label: `Gender: ${genderFilter}` });
    if (waiverFilter !== "all") filters.push({ key: "waiver", label: `Waiver: ${waiverFilter}` });
    if (foundingFilter !== "all") filters.push({ key: "founding", label: foundingFilter === "founding" ? "Founding Members" : "Regular Members" });
    if (billingTypeFilter !== "all") filters.push({ key: "billing", label: `Billing: ${billingTypeFilter}` });
    if (showCancelled) filters.push({ key: "showCancelled", label: "Including Cancelled" });
    if (issuesOnly) filters.push({ key: "issues", label: "Issues Only" });
    return filters;
  }, [searchQuery, statusFilter, tierFilter, initiationFilter, cardFilter, subscriptionFilter, genderFilter, waiverFilter, foundingFilter, billingTypeFilter, showCancelled, issuesOnly]);

  // Get pending activation members for bulk email
  const pendingActivationMembers = filteredMembers.filter(m => m.status === "pending_activation");
  const membersNeedingWaivers = members.filter(m => 
    m.user_id && 
    (m.status === "active" || m.status === "pending_activation") &&
    (!m.waiver_signed || !m.membership_agreement_signed)
  );

  // Email handlers
  const sendActivationEmail = async (member: any, e?: React.MouseEvent) => {
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

  const sendPhase1SetupEmail = async (member: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSendingActivationEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "phase_one_setup",
          to: member.email,
          data: {
            name: member.first_name,
            email: member.email,
            membershipTier: member.membership_type,
            isFoundingMember: member.is_founding_member,
            tier: member.membership_type?.toLowerCase(),
            allowTierChange: true,
            launchDate: "February 9, 2026",
            hasCardOnFile: !!member.card_last4,
          },
        },
      });
      if (error) throw error;

      await supabase
        .from("members")
        .update({ activation_email_sent_at: new Date().toISOString() })
        .eq("id", member.id);

      toast.success(`Phase 1 setup email sent to ${member.first_name}`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (error) {
      console.error("Error sending Phase 1 email:", error);
      toast.error("Failed to send Phase 1 setup email");
    } finally {
      setIsSendingActivationEmail(false);
    }
  };

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

  const sendWaiverReminderEmail = async (member: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSendingWaiverReminder(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "waiver_reminder",
          to: member.email,
          data: {
            name: member.first_name,
            email: member.email,
          },
        },
      });
      if (error) throw error;
      toast.success(`Waiver reminder sent to ${member.first_name}`);
    } catch (error) {
      console.error("Error sending waiver reminder:", error);
      toast.error("Failed to send waiver reminder");
    } finally {
      setIsSendingWaiverReminder(false);
    }
  };

  const sendBulkWaiverReminderEmails = async () => {
    if (membersNeedingWaivers.length === 0) {
      toast.error("No members need waiver reminders");
      return;
    }
    
    setIsSendingBulkWaiverReminders(true);
    let successCount = 0;
    let failCount = 0;

    for (const member of membersNeedingWaivers) {
      try {
        const { error } = await supabase.functions.invoke("send-email", {
          body: {
            type: "waiver_reminder",
            to: member.email,
            data: {
              name: member.first_name,
              email: member.email,
            },
          },
        });
        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error(`Failed to send waiver reminder to ${member.email}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Sent ${successCount} waiver reminder${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send ${failCount} reminder${failCount > 1 ? 's' : ''}`);
    }
    
    setIsSendingBulkWaiverReminders(false);
  };

  const handleViewProfile = (member: any) => {
    navigate(`/admin/members/${member.id}`);
  };

  const handleCheckIn = (member: any) => {
    navigate(`/admin/check-in?member=${member.member_id}`);
  };

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
      <div className="space-y-4">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or member ID..."
              value={searchQuery}
              onChange={(e) => updateParam("q", e.target.value || null)}
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

        {/* Quick Filter Presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center mr-2">Quick:</span>
          <Button
            variant={statusFilter === "active" && activeFilterCount === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => applyQuickFilter("active")}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Active ({filterCounts.active || 0})
          </Button>
          <Button
            variant={statusFilter === "pending_activation" && activeFilterCount === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => applyQuickFilter("pending")}
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Pending ({filterCounts.pending_activation || 0})
          </Button>
          <Button
            variant={issuesOnly && activeFilterCount === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => applyQuickFilter("needs_attention")}
            className={filterCounts.issues ? "text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700" : ""}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Issues ({filterCounts.issues || 0})
          </Button>
          <Button
            variant={initiationFilter === "unpaid" && activeFilterCount === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => applyQuickFilter("initiation_unpaid")}
            className={filterCounts.initiationUnpaid ? "text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700" : ""}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
            Initiation Due ({filterCounts.initiationUnpaid || 0})
          </Button>
          <Button
            variant={cardFilter === "no" && activeFilterCount === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => applyQuickFilter("no_card")}
          >
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            No Card ({filterCounts.noCard || 0})
          </Button>
          <Button
            variant={showCancelled && statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => applyQuickFilter("all")}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            All Members
          </Button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/30 rounded-lg border">
          <Select value={statusFilter} onValueChange={(v) => updateParam("status", v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active_default">Active (default)</SelectItem>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active ({filterCounts.active || 0})</SelectItem>
              <SelectItem value="pending_activation">Pending ({filterCounts.pending_activation || 0})</SelectItem>
              <SelectItem value="frozen">Frozen ({filterCounts.frozen || 0})</SelectItem>
              <SelectItem value="suspended">Suspended ({filterCounts.suspended || 0})</SelectItem>
              <SelectItem value="past_due">Past Due ({filterCounts.past_due || 0})</SelectItem>
              <SelectItem value="cancelled">Cancelled ({filterCounts.cancelled || 0})</SelectItem>
              <SelectItem value="expired">Expired ({filterCounts.expired || 0})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tierFilter} onValueChange={(v) => updateParam("tier", v)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="diamond">Diamond</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
            </SelectContent>
          </Select>

          <Select value={initiationFilter} onValueChange={(v) => updateParam("initiation", v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Initiation Fee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Initiation</SelectItem>
              <SelectItem value="paid">Paid ({filterCounts.initiationPaid || 0})</SelectItem>
              <SelectItem value="unpaid">Unpaid ({filterCounts.initiationUnpaid || 0})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={cardFilter} onValueChange={(v) => updateParam("card", v)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Card" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cards</SelectItem>
              <SelectItem value="yes">Has Card ({filterCounts.hasCard || 0})</SelectItem>
              <SelectItem value="no">No Card ({filterCounts.noCard || 0})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={subscriptionFilter} onValueChange={(v) => updateParam("subscription", v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Subscription" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subscriptions</SelectItem>
              <SelectItem value="active">Active ({filterCounts.hasSubscription || 0})</SelectItem>
              <SelectItem value="none">None ({filterCounts.noSubscription || 0})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={genderFilter} onValueChange={(v) => updateParam("gender", v)}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="women">Women ({filterCounts.women || 0})</SelectItem>
              <SelectItem value="men">Men ({filterCounts.men || 0})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={waiverFilter} onValueChange={(v) => updateParam("waiver", v)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Waiver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Waivers</SelectItem>
              <SelectItem value="signed">Signed ({filterCounts.waiverSigned || 0})</SelectItem>
              <SelectItem value="unsigned">Unsigned ({filterCounts.waiverUnsigned || 0})</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="show-cancelled"
              checked={showCancelled}
              onCheckedChange={(checked) => updateParam("showCancelled", checked ? "true" : null)}
            />
            <label htmlFor="show-cancelled" className="text-sm text-muted-foreground cursor-pointer">
              Show Cancelled
            </label>
          </div>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Active Filter Pills */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Showing:</span>
            {activeFilters.map((filter) => (
              <Badge
                key={filter.key}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 gap-1"
                onClick={() => updateParam(filter.key, null)}
              >
                {filter.label}
                <X className="h-3 w-3" />
              </Badge>
            ))}
            <Button variant="link" size="sm" onClick={clearAllFilters} className="text-xs h-auto p-0">
              Clear all
            </Button>
          </div>
        )}

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-2">
          {pendingActivationMembers.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
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

          {membersNeedingWaivers.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={sendBulkWaiverReminderEmails}
              disabled={isSendingBulkWaiverReminders}
              className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950"
            >
              {isSendingBulkWaiverReminders ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Send Waiver Reminders ({membersNeedingWaivers.length})
            </Button>
          )}
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Members ({filteredMembers.length})</span>
              {filteredMembers.length !== members.length && (
                <span className="text-sm font-normal text-muted-foreground">
                  of {members.length} total
                </span>
              )}
            </CardTitle>
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
                {activeFilterCount > 0 ? "No members match your filters." : "No members yet."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Email Sent</TableHead>
                    <TableHead>Next Billing</TableHead>
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
                          <EffectiveStatusBadge
                            memberStatus={member.status}
                            billingIssues={billingIssues?.memberIssues?.[member.id]}
                            size="sm"
                          />
                          <Badge 
                            variant="outline" 
                            className={
                              member.annual_fee_paid_at || member.annual_fee_subscription_id
                                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-xs"
                            }
                          >
                            {member.annual_fee_paid_at || member.annual_fee_subscription_id ? "Initiation ✓" : "Initiation Due"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <MemberIssuesBadges 
                            issues={billingIssues?.memberIssues?.[member.id]} 
                            compact 
                          />
                          <MemberArrearsIndicator memberId={member.id} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {member.status === "pending_activation" && (
                            member.activation_email_sent_at ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Activation {format(new Date(member.activation_email_sent_at), "MMM d")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs">
                                Activation not sent
                              </Badge>
                            )
                          )}
                          {(member as any).cancellation_email_sent_at && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800 text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              Cancel notice {format(new Date((member as any).cancellation_email_sent_at), "MMM d")}
                            </Badge>
                          )}
                          {member.status !== "pending_activation" && !(member as any).cancellation_email_sent_at && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.stripe_subscription_id && billingDates?.[member.stripe_subscription_id]
                          ? <span className="text-xs">{format(new Date(billingDates[member.stripe_subscription_id]), "MMM d, yyyy")}</span>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        {member.membership_start_date
                          ? format(new Date(member.membership_start_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
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
                            {member.status === "pending_activation" && member.annual_fee_paid_at && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendPhase1SetupEmail(member, e as any);
                                }}
                                disabled={isSendingActivationEmail}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send Phase 1 Setup Email
                              </DropdownMenuItem>
                            )}
                            {member.user_id && (!member.waiver_signed || !member.membership_agreement_signed) && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendWaiverReminderEmail(member, e as any);
                                }}
                                disabled={isSendingWaiverReminder}
                              >
                                <FileCheck className="h-4 w-4 mr-2" />
                                Send Waiver Reminder
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleCheckIn(member)}>
                              Check In
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

        {/* Super Admin Activation Dialog */}
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
