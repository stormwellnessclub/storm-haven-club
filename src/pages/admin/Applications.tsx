import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MoreHorizontal, Eye, CheckCircle, XCircle, Clock, Loader2, Ban, DollarSign, AlertCircle, StickyNote, Save, Download, CalendarIcon, X, RefreshCw, Link2, CreditCard, Mail, ChevronDown, Send, Zap, MailX, Plus, Wallet, Rocket, Trash2, Sparkles, FileText, Settings, Smartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChargeHistory } from "@/components/ChargeHistory";
import { BatchActivationDialog, BatchActivationConfig } from "@/components/admin/BatchActivationDialog";
import { SingleActivationDialog } from "@/components/admin/SingleActivationDialog";
import { AdminAddCardForm } from "@/components/admin/AdminAddCardForm";
import { StripeProvider } from "@/components/StripeProvider";
import { useApplicationStatusHistory } from "@/hooks/useApplicationStatusHistory";
import { History } from "lucide-react";
import { AddApplicantCardModal } from "@/components/admin/AddApplicantCardModal";
import { MarkPaidDialog, ManualPaymentMethod } from "@/components/admin/MarkPaidDialog";
import { PersonalizedLetterModal } from "@/components/admin/PersonalizedLetterModal";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AbandonedApplicationsTab } from "@/components/admin/AbandonedApplicationsTab";
import { useAbandonedApplicationsCount } from "@/hooks/useAbandonedApplications";

// Normalize membership tier from any format to consistent display name
function normalizeTierName(rawPlan: string): string {
  const lowerPlan = rawPlan.toLowerCase();
  if (lowerPlan.includes("silver") || lowerPlan === "silver") return "Silver";
  if (lowerPlan.includes("gold") || lowerPlan === "gold") return "Gold";
  if (lowerPlan.includes("platinum") || lowerPlan === "platinum") return "Platinum";
  if (lowerPlan.includes("diamond") || lowerPlan === "diamond") return "Diamond";
  return rawPlan.split(" –")[0].split(" Membership")[0]; // Fallback
}

// Format tier for display with "Membership" suffix
function formatTierDisplay(rawPlan: string): string {
  const tier = normalizeTierName(rawPlan);
  return `${tier} Membership`;
}
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import { syncCardMetadataWithRetry } from "@/hooks/useCardSyncStatus";


type Application = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  gender: string;
  email: string;
  phone: string;
  membership_plan: string;
  status: string;
  created_at: string;
  updated_at: string;
  founding_member: string;
  wellness_goals: string[];
  date_of_birth: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  lifestyle_integration: string | null;
  holistic_wellness: string | null;
  referred_by_member: string;
  services_interested: string[];
  motivations: string[] | null;
  other_goals: string | null;
  other_motivation: string | null;
  other_services: string | null;
  previous_member: string | null;
  membership_agreement_signed: boolean;
  one_year_commitment: boolean;
  credit_card_auth: boolean;
  auth_acknowledgment: boolean;
  submission_confirmation: boolean;
  ack_initiation_fee?: boolean;
  ack_card_on_file?: boolean;
  ack_final_readiness?: boolean;
  payment_info_provided: boolean;
  annual_fee_status: string;
  notes: string | null;
  stripe_customer_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  payment_link_sent_at: string | null;
  user_id: string | null;
  skip_tour_activate_immediately?: boolean;
  liability_waiver_signed?: boolean;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-accent/20 text-accent-foreground dark:bg-accent/30 dark:text-accent">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-muted/20 text-muted-foreground dark:bg-muted/30 dark:text-muted-foreground">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/20 text-destructive-foreground dark:bg-destructive/30 dark:text-destructive-foreground">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground">
          <Ban className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    default:
      return null;
  }
};

const getAnnualFeeBadge = (status: string) => {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-muted/20 text-muted-foreground dark:bg-muted/30 dark:text-muted-foreground">
          <DollarSign className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-destructive/20 text-destructive-foreground dark:bg-destructive/30 dark:text-destructive-foreground">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge className="bg-accent/20 text-accent-foreground dark:bg-accent/30 dark:text-accent">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

export default function Applications() {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRoles();
  const [searchParams, setSearchParams] = useSearchParams();
  const abandonedCount = useAbandonedApplicationsCount();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilterState] = useState<string>(
    () => searchParams.get("tab") || "all",
  );

  // Keep the URL in sync so the sidebar can deep-link straight to a tab.
  const setStatusFilter = (next: string) => {
    setStatusFilterState(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    const tab = searchParams.get("tab") || "all";
    setStatusFilterState((prev) => (prev === tab ? prev : tab));
  }, [searchParams]);

  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [pendingBulkAction, setPendingBulkAction] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [memberLinkStatus, setMemberLinkStatus] = useState<{ hasUser: boolean; hasMember: boolean; memberLinked: boolean } | null>(null);

  // Authoritative waiver record lives on the member's profile (signed in-app),
  // not on the application's acknowledgement checkbox.
  const { data: waiverRecord } = useQuery({
    queryKey: ["application-waiver-record", selectedApplication?.email?.toLowerCase()],
    enabled: !!selectedApplication?.email,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("waiver_signed, waiver_signed_at")
        .ilike("email", selectedApplication!.email)
        .order("waiver_signed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  
  // Charge dialog state
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [chargeTarget, setChargeTarget] = useState<Application | null>(null);
  const [chargeAmount, setChargeAmount] = useState("300");
  const [chargeDescription, setChargeDescription] = useState("Initiation Fee");
  const [isCharging, setIsCharging] = useState(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  
  // Enhanced charge dialog state
  const [cardDetails, setCardDetails] = useState<{
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [addCardClientSecret, setAddCardClientSecret] = useState<string | null>(null);
  const [addCardCustomerId, setAddCardCustomerId] = useState<string | null>(null);
  const [chargeSuccessData, setChargeSuccessData] = useState<{
    success: boolean;
    cardBrand: string;
    cardLast4: string;
    amount: string;
  } | null>(null);
  
  // Post-charge options
  const [afterChargeOptions, setAfterChargeOptions] = useState({
    markInitiationFeePaid: true,
    syncToMemberProfile: true,
    approveAndSendEmail: false,
    autoActivate: false,
    activationDate: new Date(),
  });
  
  // Batch activation dialog state
  const [showBatchActivationDialog, setShowBatchActivationDialog] = useState(false);
  const [isBatchActivating, setIsBatchActivating] = useState(false);
  
  // Single activation dialog state
  const [showSingleActivationDialog, setShowSingleActivationDialog] = useState(false);
  const [singleActivationTarget, setSingleActivationTarget] = useState<Application | null>(null);
  const [isSingleActivating, setIsSingleActivating] = useState(false);
  
  // Add card dialog state
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [cardTargetApplication, setCardTargetApplication] = useState<Application | null>(null);
  
  // Locked start date dialog state
  const [showLockedDateDialog, setShowLockedDateDialog] = useState(false);
  
  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);
  
  // Payment link dialog state
  const [showPaymentLinkDialog, setShowPaymentLinkDialog] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [paymentLinkTarget, setPaymentLinkTarget] = useState<Application | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [paymentLinkEmailSent, setPaymentLinkEmailSent] = useState(false);
  const [paymentLinkEmailAddress, setPaymentLinkEmailAddress] = useState<string | null>(null);
  
  // Mark Paid Dialog state
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<Application | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  
  // Personalized Letter Modal state
  const [showPersonalizedLetterModal, setShowPersonalizedLetterModal] = useState(false);
  const [personalizedLetterTarget, setPersonalizedLetterTarget] = useState<Application | null>(null);
  
  // Email sending state
  const [isSendingPaymentRequest, setIsSendingPaymentRequest] = useState(false);
  const [isSendingFinalNotice, setIsSendingFinalNotice] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["membership-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
    enabled: !!user,
    retry: 2,
  });

  // Query email audit log to show what emails were sent
  const { data: emailAuditData = [] } = useQuery({
    queryKey: ["email-audit-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_audit_log")
        .select("application_id, email_type, sent_at, status, error_message")
        .not("application_id", "is", null)
        .order("sent_at", { ascending: false });
      if (error) {
        console.error("Failed to fetch email audit log:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
  });

  // Create a map of application_id -> latest email info
  const emailStatusByApplication = useMemo(() => {
    const map = new Map<string, { type: string; sentAt: string; status: string; errorMessage?: string | null }>();
    for (const log of emailAuditData) {
      if (log.application_id && !map.has(log.application_id)) {
        map.set(log.application_id, {
          type: log.email_type,
          sentAt: log.sent_at || "",
          status: log.status,
          errorMessage: (log as any).error_message ?? null,
        });
      }
    }
    return map;
  }, [emailAuditData]);

  // Full history of card-decline emails per application (for detail view & filter)
  const cardDeclineHistoryByApp = useMemo(() => {
    const map = new Map<string, Array<{ sentAt: string; status: string; errorMessage?: string | null }>>();
    for (const log of emailAuditData) {
      if (log.email_type !== "application_card_declined" || !log.application_id) continue;
      const arr = map.get(log.application_id) || [];
      arr.push({
        sentAt: log.sent_at || "",
        status: log.status,
        errorMessage: (log as any).error_message ?? null,
      });
      map.set(log.application_id, arr);
    }
    return map;
  }, [emailAuditData]);

  // Check member link status when viewing an approved application
  const checkMemberLinkStatus = async (email: string) => {
    setMemberLinkStatus(null);
    
    // Check if there's a user account with this email
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();
    
    // Check if there's a member record for this email
    const { data: member } = await supabase
      .from("members")
      .select("id, user_id, email")
      .ilike("email", email)
      .maybeSingle();
    
    setMemberLinkStatus({
      hasUser: !!profile?.user_id,
      hasMember: !!member,
      memberLinked: !!member?.user_id,
    });
  };

  const linkMemberMutation = useMutation({
    mutationFn: async ({ memberId, email }: { memberId: string; email: string }) => {
      const { data, error } = await supabase
        .rpc("admin_link_member_to_user", {
          _member_id: memberId,
          _user_email: email,
        });
      if (error) throw error;
      if (!data) throw new Error("User account not found for this email");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success("Member linked to user account");
      if (selectedApplication) {
        checkMemberLinkStatus(selectedApplication.email);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link member");
    },
  });

  // Enhanced approval mutation with email control and auto-activation options
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      application,
      suppressEmail = false,
      autoActivate = false,
      startDate,
      lockedStartDate,
      isPreLaunch = false,
    }: { 
      id: string; 
      status: string; 
      application?: Application;
      suppressEmail?: boolean;
      autoActivate?: boolean;
      startDate?: Date;
      lockedStartDate?: Date;
      isPreLaunch?: boolean;
    }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      
      // Sync member status when cancelling/rejecting application
      if (status === "cancelled" || status === "rejected") {
        // Get the application email first
        const { data: appData } = await supabase
          .from("membership_applications")
          .select("email")
          .eq("id", id)
          .single();
        
        if (appData?.email) {
          const { error: memberUpdateError } = await supabase
            .from("members")
            .update({ 
              status: "cancelled",
              updated_at: new Date().toISOString()
            })
            .ilike("email", appData.email)
            .eq("status", "pending_activation");
          
          if (memberUpdateError) {
            console.error("Failed to sync member status:", memberUpdateError);
          } else {
            console.log("Synced member status to cancelled for:", appData.email);
          }
        }
      }
      
      // Create member record when status is approved
      if (status === "approved" && application) {
        const now = new Date();
        const activationDeadline = lockedStartDate 
          ? new Date(lockedStartDate.getTime()) // Deadline is the locked date itself
          : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        
        const firstName = application.first_name || application.full_name.trim().split(" ")[0] || "";
        const lastName = application.last_name || application.full_name.trim().split(" ").slice(1).join(" ") || "";
        const gender = application.gender || "Women";
        
        // Check if member already exists for this email
        const { data: existingMember } = await supabase
          .from("members")
          .select("id, email, status, membership_type")
          .ilike("email", application.email)
          .maybeSingle();
        
        if (existingMember) {
          // If the existing member is cancelled, delete the old record so we can create a fresh one
          if (existingMember.status === 'cancelled') {
            console.log("Found cancelled member for:", application.email, "— removing old record to allow re-application");
            await supabase.from("members").delete().eq("id", existingMember.id);
          } else {
            console.log("Member already exists for:", application.email, "status:", existingMember.status);
            toast.warning(`Member record already exists for ${application.email} (status: ${existingMember.status}). Skipping creation.`);
            
            // Still send email if not suppressed and not auto-activating
            if (!suppressEmail && !autoActivate) {
              try {
                const emailType = lockedStartDate ? "application_approved_locked_date" : "application_approved";
                await supabase.functions.invoke("send-email", {
                  body: {
                    type: emailType,
                    to: application.email,
                    data: lockedStartDate 
                      ? { name: firstName, lockedStartDate: format(lockedStartDate, "MMMM d, yyyy") }
                      : { name: firstName, activationDeadline: format(activationDeadline, "MMMM d, yyyy") },
                  },
                });
              } catch (emailError) {
                console.error("Failed to send approval email:", emailError);
              }
            }
            return;
          }
        }
        
        // Look up user_id by email
        let userId: string | null = null;
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("email", application.email)
          .maybeSingle();
        
        if (profileData?.user_id) {
          userId = profileData.user_id;
        }
        
        // Determine member status and dates based on autoActivate
        const memberStatus = autoActivate ? "active" : "pending_activation";
        const membershipStartDate = autoActivate && startDate ? format(startDate, "yyyy-MM-dd") : format(now, "yyyy-MM-dd");
        const activatedAt = autoActivate ? now.toISOString() : null;
        // Set annual_fee_paid_at if already paid in application, regardless of autoActivate
        const annualFeePaidAt = application.annual_fee_status === "paid" ? now.toISOString() : null;
        
        // Create member record - include locked_start_date if provided
        const memberInsertData: any = {
          first_name: firstName,
          last_name: lastName,
          email: application.email,
          phone: application.phone,
          membership_type: normalizeTierName(application.membership_plan),
          status: memberStatus,
          approved_at: now.toISOString(),
          activation_deadline: autoActivate ? null : activationDeadline.toISOString(),
          activated_at: activatedAt,
          membership_start_date: membershipStartDate,
          user_id: userId,
          is_founding_member: application.founding_member?.toLowerCase() === "yes",
          gender: gender,
          stripe_customer_id: application.stripe_customer_id || null,
          annual_fee_paid_at: annualFeePaidAt,
          // Copy card details from application to member
          card_brand: application.card_brand || null,
          card_last4: application.card_last4 || null,
          card_exp_month: application.card_exp_month || null,
          card_exp_year: application.card_exp_year || null,
        };
        
        // Add locked_start_date if provided (for locked mode)
        if (lockedStartDate && !autoActivate) {
          memberInsertData.locked_start_date = format(lockedStartDate, "yyyy-MM-dd");
        }
        
        const { data: insertedMember, error: memberError } = await supabase
          .from("members")
          .insert(memberInsertData)
          .select("id")
          .maybeSingle();
        
        if (memberError) {
          console.error("Failed to create member record:", memberError);
        }

        // If the application never captured card metadata but a Stripe customer
        // exists, pull the card down now so the member doesn't show "Not Synced".
        if (insertedMember?.id && !application.card_last4 && application.stripe_customer_id) {
          try {
            await syncCardMetadataWithRetry(insertedMember.id, application.stripe_customer_id, 2);
          } catch (syncErr) {
            console.warn("Card metadata sync after approval failed:", syncErr);
          }
        }

        
        // Send appropriate email based on options
        if (!suppressEmail) {
          try {
            // Get current admin user for audit logging
            const { data: { user: adminUser } } = await supabase.auth.getUser();
            let emailType = "";
            let emailData: any = {};
            
            if (autoActivate) {
              // Send welcome email for auto-activated members
              emailType = "membership_activated";
              emailData = {
                name: firstName,
                membershipType: application.membership_plan,
                startDate: format(startDate || now, "MMMM d, yyyy"),
              };
              await supabase.functions.invoke("send-email", {
                body: {
                  type: emailType,
                  to: application.email,
                  data: emailData,
                },
              });
            } else if (isPreLaunch) {
              // Send pre-launch email (no links to website/auth)
              emailType = "approval_letter";
              emailData = {
                name: firstName,
                membershipTier: normalizeTierName(application.membership_plan) + " Membership",
              };
              await supabase.functions.invoke("send-email", {
                body: {
                  type: emailType,
                  to: application.email,
                  data: emailData,
                },
              });
            } else if (lockedStartDate) {
              // Send locked date email
              emailType = "application_approved_locked_date";
              emailData = {
                name: firstName,
                lockedStartDate: format(lockedStartDate, "MMMM d, yyyy"),
              };
              await supabase.functions.invoke("send-email", {
                body: {
                  type: emailType,
                  to: application.email,
                  data: emailData,
                },
              });
            } else {
              // Send approval email with activation instructions
              emailType = "approval_with_deadline";
              emailData = {
                name: firstName,
                activationDeadline: format(activationDeadline, "MMMM d, yyyy"),
              };
              await supabase.functions.invoke("send-email", {
                body: {
                  type: emailType,
                  to: application.email,
                  data: emailData,
                },
              });
            }
            
            // Log to email audit for all approval emails
            if (adminUser && emailType) {
              await supabase.from("email_audit_log" as any).insert({
                email_type: emailType,
                recipient_email: application.email,
                recipient_name: firstName,
                triggered_by: adminUser.id,
                trigger_source: "admin_approval",
                application_id: id,
                template_data: emailData,
                status: "sent",
                sent_at: new Date().toISOString(),
              });
            }
          } catch (emailError) {
            console.error("Failed to send email:", emailError);
          }
        }
      }
      
      // Handle application rejection with email notification
      if (status === "rejected" && application && !suppressEmail) {
        const firstName = application.first_name || application.full_name.trim().split(" ")[0] || "";
        
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "application_rejected",
              to: application.email,
              data: {
                name: firstName,
              },
            },
          });
        } catch (emailError) {
          console.error("Failed to send rejection email:", emailError);
          // Don't throw - status update succeeded, email is secondary
        }
      }

      // Handle application cancellation with email notification
      if (status === "cancelled" && application && !suppressEmail) {
        const firstName = application.first_name || application.full_name.trim().split(" ")[0] || "";
        
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "application_cancelled",
              to: application.email,
              data: {
                name: firstName,
              },
            },
          });
        } catch (emailError) {
          console.error("Failed to send cancellation email:", emailError);
        }
      }
    },
    onSuccess: (_, { status, suppressEmail, autoActivate, lockedStartDate, isPreLaunch }) => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      queryClient.invalidateQueries({ queryKey: ["email-audit-applications"] });
      if (status === "approved") {
        if (autoActivate) {
          toast.success("Application approved & member auto-activated");
        } else if (isPreLaunch) {
          toast.success("Application approved & pre-launch email sent");
        } else if (lockedStartDate) {
          toast.success("Application approved with locked start date & email sent");
        } else if (suppressEmail) {
          toast.success("Application approved (email suppressed), member created");
        } else {
          toast.success("Application approved, member created & email sent");
        }
      } else if (status === "rejected") {
        if (suppressEmail) {
          toast.success("Application rejected (email suppressed)");
        } else {
          toast.success("Application rejected & email sent");
        }
      } else {
        toast.success("Application status updated");
      }
      setSelectedApplication(null);
    },
    onError: () => {
      toast.error("Failed to update application");
    },
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("membership_applications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success("Application deleted");
      setShowDeleteDialog(false);
      setApplicationToDelete(null);
    },
    onError: () => {
      toast.error("Failed to delete application");
    },
  });

  const updateAnnualFeeMutation = useMutation({
    mutationFn: async ({ 
      id, 
      annual_fee_status, 
      paymentMethod, 
      note 
    }: { 
      id: string; 
      annual_fee_status: string; 
      paymentMethod?: ManualPaymentMethod; 
      note?: string;
    }) => {
      // Get application email for member lookup
      const { data: appData, error: appError } = await supabase
        .from("membership_applications")
        .select("email")
        .eq("id", id)
        .single();
      
      if (appError) throw appError;
      
      // Update application
      const { error } = await supabase
        .from("membership_applications")
        .update({ annual_fee_status })
        .eq("id", id);
      if (error) throw error;
      
      // CRITICAL: If marking as paid, sync to member table
      if (annual_fee_status === "paid" && appData?.email) {
        const { data: memberData } = await supabase
          .from("members")
          .select("id")
          .ilike("email", appData.email)
          .maybeSingle();
        
        if (memberData) {
          await supabase
            .from("members")
            .update({ 
              annual_fee_paid_at: new Date().toISOString() 
            })
            .eq("id", memberData.id);
          console.log("Synced annual_fee_paid_at to member:", memberData.id);
        }
        
        // Record manual charge for audit trail (only if paymentMethod provided)
        if (paymentMethod && user) {
          await supabase
            .from("manual_charges")
            .insert({
              application_id: id,
              user_id: user.id,
              amount: 30000, // $300 in cents - standard initiation fee
              description: `Initiation Fee - Manual (${paymentMethod})${note ? `: ${note}` : ''}`,
              status: 'succeeded',
              charged_by: user.id,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success("Annual fee status updated");
      setShowMarkPaidDialog(false);
      setMarkPaidTarget(null);
    },
    onError: () => {
      toast.error("Failed to update annual fee status");
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success("Notes saved");
    },
    onError: () => {
      toast.error("Failed to save notes");
    },
  });

  const handleOpenApplication = (app: Application) => {
    setSelectedApplication(app);
    setNotesValue(app.notes || "");
    setMemberLinkStatus(null);
    // Check link status for approved applications
    if (app.status === "approved") {
      checkMemberLinkStatus(app.email);
    }
  };

  const openChargeDialog = async (app: Application) => {
    setChargeTarget(app);
    setChargeAmount("300");
    setChargeDescription("Initiation Fee");
    setShowChargeDialog(true);
    setCardDetails(null);
    setChargeSuccessData(null);
    setShowAddCardForm(false);
    setAddCardClientSecret(null);
    setAfterChargeOptions({
      markInitiationFeePaid: true,
      syncToMemberProfile: true,
      approveAndSendEmail: false,
      autoActivate: false,
      activationDate: new Date(),
    });
    
    // Fetch card details if customer ID exists
    if (app.stripe_customer_id) {
      setIsLoadingCard(true);
      try {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "list_application_payment_methods",
            stripeCustomerId: app.stripe_customer_id,
          },
        });
        
        if (!error && data?.paymentMethods?.length > 0) {
          const card = data.paymentMethods[0];
          setCardDetails({
            brand: card.brand,
            last4: card.last4,
            expMonth: card.expMonth,
            expYear: card.expYear,
          });
        }
      } catch (err) {
        console.error("Failed to fetch card details:", err);
      } finally {
        setIsLoadingCard(false);
      }
    }
  };

  const openSingleActivationDialog = (app: Application) => {
    setSingleActivationTarget(app);
    setShowSingleActivationDialog(true);
  };

  const handleAddApplicantCard = (app: Application) => {
    setCardTargetApplication(app);
    setShowAddCardDialog(true);
  };

  const handleSingleActivation = async (config: { mode: "immediate" | "locked"; startDate: Date; chargeAnnualFee: boolean; createSubscription: boolean }) => {
    if (!singleActivationTarget) return;
    
    setIsSingleActivating(true);
    try {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expired. Please log in again.");
      }

      // If we need to charge the annual fee first (only for immediate mode with card on file)
      if (config.chargeAnnualFee && singleActivationTarget.stripe_customer_id && config.mode === "immediate") {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            stripeCustomerId: singleActivationTarget.stripe_customer_id,
            applicantName: singleActivationTarget.full_name,
            applicationId: singleActivationTarget.id,
            amount: 30000, // $300 in cents
            description: "Annual Membership Fee",
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Update annual fee status
        await supabase
          .from("membership_applications")
          .update({ annual_fee_status: "paid" })
          .eq("id", singleActivationTarget.id);

        // Send charge confirmation email
        try {
          const baseAnnual = 300;
          const feeAnnual = calculateProcessingFeeFromDollars(baseAnnual);
          const totalAnnual = baseAnnual + feeAnnual;
          await supabase.functions.invoke("send-email", {
            body: {
              type: "charge_confirmation",
              to: singleActivationTarget.email,
              data: {
                name: singleActivationTarget.first_name || singleActivationTarget.full_name.split(" ")[0],
                description: `Annual Membership Fee (includes $${feeAnnual.toFixed(2)} processing fee)`,
                amount: totalAnnual.toFixed(2),
                date: new Date().toLocaleDateString("en-US", { 
                  year: "numeric", 
                  month: "long", 
                  day: "numeric" 
                }),
                cardBrand: data.cardBrand || "Card",
                cardLast4: data.cardLast4 || "****",
              },
            },
          });
        } catch (emailError) {
          console.error("Failed to send charge confirmation email:", emailError);
        }
      }

      // Update the application's annual_fee_status to reflect current state for the mutation
      const updatedApp = {
        ...singleActivationTarget,
        annual_fee_status: config.chargeAnnualFee && config.mode === "immediate" ? "paid" : singleActivationTarget.annual_fee_status,
      };

      if (config.mode === "immediate") {
        // Immediate activation - member becomes active now
        await updateStatusMutation.mutateAsync({
          id: singleActivationTarget.id,
          status: "approved",
          application: updatedApp,
          autoActivate: true,
          startDate: config.startDate,
        });

        // Create subscription if enabled and card on file
        if (config.createSubscription && singleActivationTarget.stripe_customer_id) {
          try {
            // Find the newly created member to get their ID
            const { data: newMember } = await supabase
              .from("members")
              .select("id")
              .ilike("email", singleActivationTarget.email)
              .maybeSingle();

            if (newMember) {
              const tier = normalizeTierName(singleActivationTarget.membership_plan);
              const gender = singleActivationTarget.gender?.toLowerCase() === 'male' ? 'men' : 'women';
              const isFounding = singleActivationTarget.founding_member?.toLowerCase() === 'yes';
              const billingType = isFounding ? 'annual' : 'monthly';

              const { error: subError } = await supabase.functions.invoke("stripe-payment", {
                body: {
                  action: "admin_create_member_subscription",
                  memberId: newMember.id,
                  tier,
                  gender,
                  billingType,
                  isFoundingMember: isFounding,
                  startDate: format(config.startDate, "yyyy-MM-dd"),
                },
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });

              if (subError) {
                console.error("Failed to create subscription:", subError);
                toast.error("Member activated but subscription creation failed. Create it manually.");
              } else {
                toast.success("Member activated with subscription!");
              }
            }
          } catch (subErr) {
            console.error("Subscription creation error:", subErr);
            toast.error("Member activated but subscription creation failed");
          }
        }
      } else {
        // Locked mode - member must complete activation themselves
        await updateStatusMutation.mutateAsync({
          id: singleActivationTarget.id,
          status: "approved",
          application: updatedApp,
          autoActivate: false,
          lockedStartDate: config.startDate,
        });
      }

      setShowSingleActivationDialog(false);
      setSingleActivationTarget(null);
    } catch (error: any) {
      console.error("Single activation error:", error);
      toast.error(error.message || "Failed to activate member");
    } finally {
      setIsSingleActivating(false);
    }
  };

  const handleChargeApplicationCard = async () => {
    if (!chargeTarget?.stripe_customer_id) {
      toast.error("No payment method on file");
      return;
    }

    const amountNum = parseFloat(chargeAmount);
    if (isNaN(amountNum) || amountNum < 0.50) {
      toast.error("Minimum charge amount is $0.50");
      return;
    }

    if (!chargeDescription.trim()) {
      toast.error("Description is required");
      return;
    }

    setIsCharging(true);
    try {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expired. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card",
          stripeCustomerId: chargeTarget.stripe_customer_id,
          applicantName: chargeTarget.full_name,
          applicationId: chargeTarget.id,
          amount: Math.round(amountNum * 100), // Convert to cents
          description: chargeDescription,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        const chargeFee = calculateProcessingFeeFromDollars(amountNum);
        const chargeTotal = amountNum + chargeFee;
        // Show success state with card details — show total actually charged
        setChargeSuccessData({
          success: true,
          cardBrand: data.cardBrand || "Card",
          cardLast4: data.cardLast4 || "****",
          amount: chargeTotal.toFixed(2),
        });
        
        // Send charge confirmation email
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "charge_confirmation",
              to: chargeTarget.email,
              data: {
                name: chargeTarget.first_name || chargeTarget.full_name.split(" ")[0],
                description: `${chargeDescription} (includes $${chargeFee.toFixed(2)} processing fee)`,
                amount: chargeTotal.toFixed(2),
                date: new Date().toLocaleDateString("en-US", { 
                  year: "numeric", 
                  month: "long", 
                  day: "numeric" 
                }),
                cardBrand: data.cardBrand || "Card",
                cardLast4: data.cardLast4 || "****",
              },
            },
          });
        } catch (emailErr) {
          console.error("Failed to send confirmation email:", emailErr);
        }
        
        // Check if this is an initiation/annual fee charge
        const isInitiationFee = chargeDescription.toLowerCase().includes("initiation") ||
                                chargeDescription.toLowerCase().includes("annual fee");
        
        // Update annual fee status if enabled (application table)
        if (isInitiationFee && afterChargeOptions.markInitiationFeePaid) {
          await supabase
            .from("membership_applications")
            .update({ annual_fee_status: "paid" })
            .eq("id", chargeTarget.id);
        }
        
        // Sync to member profile if checkbox enabled (member table - done by edge function)
        // The edge function already handles this, but we can do a frontend update for immediate UI feedback
        if (isInitiationFee && afterChargeOptions.syncToMemberProfile) {
          const { data: memberData } = await supabase
            .from("members")
            .select("id")
            .ilike("email", chargeTarget.email)
            .maybeSingle();
          
          if (memberData) {
            await supabase
              .from("members")
              .update({ 
                annual_fee_paid_at: new Date().toISOString(),
                stripe_customer_id: chargeTarget.stripe_customer_id,
              })
              .eq("id", memberData.id);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
        toast.success(`Successfully charged $${chargeTotal.toFixed(2)} (incl. $${chargeFee.toFixed(2)} fee)`);
      } else {
        throw new Error("Charge was not successful");
      }
    } catch (err: any) {
      console.error("Charge error:", err);
      // Auto-fire the applicant card-decline email (scoped to approval-charge flow only)
      if (chargeTarget) {
        const ok = await sendApplicationCardDeclinedEmail(chargeTarget, { silent: true, source: "auto_on_decline" });
        if (ok) {
          toast.warning(`Card declined — payment update email sent to ${chargeTarget.email}`, { duration: 12000 });
        } else {
          toast.error(`Card declined AND decline-notice email failed for ${chargeTarget.email} — please contact them manually`, { duration: 15000 });
        }
      } else {
        toast.error(err.message || "Failed to charge card");
      }
    } finally {
      setIsCharging(false);
    }
  };

  // Send card-declined email to an applicant (used both auto on decline and via Resend button).
  // Scoped strictly to the Applications admin charge flow — NOT used for recurring dues failures.
  const sendApplicationCardDeclinedEmail = async (
    app: Application,
    opts?: { silent?: boolean; source?: string },
  ) => {
    const firstName = app.first_name || app.full_name.split(" ")[0];
    let sendError: any = null;

    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "application_card_declined",
          to: app.email,
          data: { name: firstName, first_name: firstName },
        },
      });
      if (error) sendError = error;
    } catch (err: any) {
      sendError = err;
    }

    // Always log to audit (success OR failure) so admins have a paper trail.
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from("email_audit_log" as any).insert({
        email_type: "application_card_declined",
        recipient_email: app.email,
        recipient_name: firstName,
        triggered_by: currentUser?.id ?? null,
        trigger_source: opts?.source || "admin_resend",
        application_id: app.id,
        status: sendError ? "failed" : "sent",
        error_message: sendError ? (sendError.message || String(sendError)).slice(0, 500) : null,
        sent_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("Audit log failed for application_card_declined:", auditErr);
    }

    queryClient.invalidateQueries({ queryKey: ["email-audit-applications"] });

    if (sendError) {
      console.error("Failed to send card-decline email:", sendError);
      if (!opts?.silent) toast.error(`Card-decline email FAILED for ${app.email}`, { duration: 10000 });
      return false;
    }

    if (!opts?.silent) toast.success(`Card-decline email sent to ${app.email}`);
    return true;
  };


  // Handle adding a new card for applicant
  const handleAddCard = async () => {
    if (!chargeTarget) return;
    
    setIsLoadingCard(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_admin_setup_intent",
          stripeCustomerId: chargeTarget.stripe_customer_id,
          applicantEmail: chargeTarget.email,
          applicantName: chargeTarget.full_name,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setAddCardClientSecret(data.clientSecret);
      setAddCardCustomerId(data.customerId);
      setShowAddCardForm(true);
      
      // Update application with customer ID if newly created
      if (data.customerId && !chargeTarget.stripe_customer_id) {
        await supabase
          .from("membership_applications")
          .update({ stripe_customer_id: data.customerId })
          .eq("id", chargeTarget.id);
        
        setChargeTarget({ ...chargeTarget, stripe_customer_id: data.customerId });
        queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize card form");
    } finally {
      setIsLoadingCard(false);
    }
  };

  // Handle card saved successfully
  const handleCardSaved = async () => {
    setShowAddCardForm(false);
    setAddCardClientSecret(null);
    
    // Determine which customer ID to use
    const customerId = chargeTarget?.stripe_customer_id || addCardCustomerId;
    
    // Refresh card details and persist to database
    if (customerId && chargeTarget) {
      setIsLoadingCard(true);
      try {
        const { data } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "list_application_payment_methods",
            stripeCustomerId: customerId,
          },
        });
        
        if (data?.paymentMethods?.length > 0) {
          const card = data.paymentMethods[0];
          setCardDetails({
            brand: card.brand,
            last4: card.last4,
            expMonth: card.expMonth,
            expYear: card.expYear,
          });
          
          // Persist card metadata to the application record
          await supabase
            .from("membership_applications")
            .update({
              card_brand: card.brand,
              card_last4: card.last4,
              card_exp_month: card.expMonth,
              card_exp_year: card.expYear,
              payment_info_provided: true,
              stripe_customer_id: customerId,
            })
            .eq("id", chargeTarget.id);
          
          // Update local chargeTarget state
          setChargeTarget({
            ...chargeTarget,
            stripe_customer_id: customerId,
            card_brand: card.brand,
            card_last4: card.last4,
            card_exp_month: card.expMonth,
            card_exp_year: card.expYear,
          });
        }
      } catch (err) {
        console.error("Failed to refresh card details:", err);
      } finally {
        setIsLoadingCard(false);
      }
    }
    
    setAddCardCustomerId(null);
    queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
  };

  // Execute post-charge actions (approve, activate)
  const handleExecutePostChargeActions = async () => {
    if (!chargeTarget) return;
    
    try {
      // Update application's annual_fee_status to reflect current state for the mutation
      const updatedApp = {
        ...chargeTarget,
        annual_fee_status: "paid",
      };

      if (afterChargeOptions.autoActivate) {
        // Auto-activate overrides approve - it does both
        await updateStatusMutation.mutateAsync({
          id: chargeTarget.id,
          status: "approved",
          application: updatedApp,
          autoActivate: true,
          startDate: afterChargeOptions.activationDate,
        });
      } else if (afterChargeOptions.approveAndSendEmail && chargeTarget.status !== "approved") {
        await updateStatusMutation.mutateAsync({
          id: chargeTarget.id,
          status: "approved",
          application: updatedApp,
          suppressEmail: false,
        });
      }
      
      setShowChargeDialog(false);
      setChargeTarget(null);
      setChargeSuccessData(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to execute post-charge actions");
    }
  };

  const handleRequestPaymentInfo = async (app: Application) => {
    setIsRequestingPayment(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "payment_update_request",
          to: app.email,
          data: {
            name: app.first_name || app.full_name.split(" ")[0],
            email: app.email,
          },
        },
      });

      if (error) throw error;
      toast.success(`Payment request email sent to ${app.email}`);
    } catch (err: any) {
      console.error("Email error:", err);
      toast.error(err.message || "Failed to send email");
    } finally {
      setIsRequestingPayment(false);
    }
  };

  // Send initiation fee payment request email
  const handleSendPaymentRequest = async (app: Application) => {
    setIsSendingPaymentRequest(true);
    const firstName = app.first_name || app.full_name.trim().split(" ")[0];
    
    try {
      // Generate payment link
      const { data: linkData, error: linkError } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_annual_fee_payment_link",
          applicationId: app.id,
          gender: app.gender || "Women",
          successUrl: window.location.origin + "/payment-success?type=annual_fee",
          cancelUrl: window.location.origin,
        },
      });
      
      if (linkError) throw linkError;
      
      // Send email
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "annual_fee_payment_request",
          to: app.email,
          data: {
            name: firstName,
            amount: 300,
            paymentUrl: linkData?.url || `${window.location.origin}/auth`,
          },
        },
      });
      
      if (error) throw error;
      toast.success(`Payment request sent to ${app.email}`);
    } catch (err: any) {
      console.error("Send payment request error:", err);
      toast.error(err.message || "Failed to send payment request");
    } finally {
      setIsSendingPaymentRequest(false);
    }
  };

  // Send final notice email
  const handleSendFinalNotice = async (app: Application) => {
    setIsSendingFinalNotice(true);
    const firstName = app.first_name || app.full_name.trim().split(" ")[0];
    
    try {
      // Generate payment link
      const { data: linkData, error: linkError } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_annual_fee_payment_link",
          applicationId: app.id,
          gender: app.gender || "Women",
          successUrl: window.location.origin + "/payment-success?type=annual_fee",
          cancelUrl: window.location.origin,
        },
      });
      
      if (linkError) throw linkError;
      
      // Send final notice email
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "annual_fee_final_notice",
          to: app.email,
          data: {
            name: firstName,
            amount: 300,
            paymentUrl: linkData?.url || `${window.location.origin}/auth`,
          },
        },
      });
      
      if (error) throw error;
      toast.success(`Final notice sent to ${app.email}`);
    } catch (err: any) {
      console.error("Send final notice error:", err);
      toast.error(err.message || "Failed to send final notice");
    } finally {
      setIsSendingFinalNotice(false);
    }
  };

  // Generate payment link for annual fee
  const handleGeneratePaymentLink = async (app: Application) => {
    setIsGeneratingLink(true);
    setPaymentLinkTarget(app);
    setPaymentLinkEmailSent(false);
    setPaymentLinkEmailAddress(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_annual_fee_payment_link",
          applicationId: app.id,
          gender: app.gender || "women",
          successUrl: window.location.origin + "/payment-success?type=annual_fee",
          cancelUrl: window.location.origin,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setPaymentLinkUrl(data.url);
      setPaymentLinkEmailSent(data.emailSent || false);
      setPaymentLinkEmailAddress(data.emailAddress || app.email);
      setShowPaymentLinkDialog(true);
      
      if (data.emailSent) {
        toast.success(`Payment link emailed to ${data.emailAddress}`);
      }
    } catch (err: any) {
      console.error("Payment link error:", err);
      toast.error(err.message || "Failed to generate payment link");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!paymentLinkUrl) return;
    
    try {
      await navigator.clipboard.writeText(paymentLinkUrl);
      toast.success("Payment link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Full Name",
      "Email",
      "Phone",
      "Membership Plan",
      "Status",
      "Annual Fee Status",
      "Founding Member",
      "Date of Birth",
      "Address",
      "City",
      "State",
      "Zip Code",
      "Wellness Goals",
      "Services Interested",
      "Lifestyle Integration",
      "Holistic Wellness",
      "Referred By Member",
      "Notes",
      "Submitted"
    ];

    const escapeCSV = (value: string | null | undefined) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredApplications.map((app) => [
      escapeCSV(app.full_name),
      escapeCSV(app.email),
      escapeCSV(app.phone),
      escapeCSV(app.membership_plan),
      escapeCSV(app.status),
      escapeCSV(app.annual_fee_status),
      escapeCSV(app.founding_member),
      escapeCSV(app.date_of_birth),
      escapeCSV(app.address),
      escapeCSV(app.city),
      escapeCSV(app.state),
      escapeCSV(app.zip_code),
      escapeCSV(app.wellness_goals?.join("; ")),
      escapeCSV(app.services_interested?.join("; ")),
      escapeCSV(app.lifestyle_integration),
      escapeCSV(app.holistic_wellness),
      escapeCSV(app.referred_by_member),
      escapeCSV(app.notes),
      escapeCSV(format(new Date(app.created_at), "yyyy-MM-dd HH:mm:ss"))
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredApplications.length} applications`);
  };

  const membershipPlans = [...new Set(applications.map((app) => app.membership_plan))].sort();

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all"
        ? app.status !== "pending_payment"
        : statusFilter === "abandoned"
          ? false
          : statusFilter === "card_declined"
            ? app.status === "approved" && cardDeclineHistoryByApp.has(app.id)
            : app.status === statusFilter;
    const matchesPlan = planFilter === "all" || app.membership_plan === planFilter;

    const appDate = new Date(app.created_at);
    const matchesDateFrom = !dateFrom || !isBefore(appDate, startOfDay(dateFrom));
    const matchesDateTo = !dateTo || !isAfter(appDate, endOfDay(dateTo));

    return matchesSearch && matchesStatus && matchesPlan && matchesDateFrom && matchesDateTo;
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const cardDeclinedCount = applications.filter(
    (a) => a.status === "approved" && cardDeclineHistoryByApp.has(a.id),
  ).length;

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ 
      ids, 
      status,
      suppressEmail = false,
    }: { 
      ids: string[]; 
      status: string;
      suppressEmail?: boolean;
    }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
      
      // Create member records and optionally send approval emails for bulk approvals
      if (status === "approved") {
        const approvedApps = applications.filter(app => ids.includes(app.id));
        let skippedCount = 0;
        
        for (const app of approvedApps) {
          const now = new Date();
          const activationDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          const firstName = app.first_name || app.full_name.trim().split(" ")[0] || "";
          const lastName = app.last_name || app.full_name.trim().split(" ").slice(1).join(" ") || "";
          const gender = app.gender || "Women";
          
          // Check if member already exists
          const { data: existingMember } = await supabase
            .from("members")
            .select("id, email, status")
            .ilike("email", app.email)
            .maybeSingle();
          
          if (existingMember) {
            console.log("Bulk: Member already exists for:", app.email);
            skippedCount++;
            // Send email only if not suppressed
            if (!suppressEmail) {
              try {
                await supabase.functions.invoke("send-email", {
                  body: {
                    type: "application_approved",
                    to: app.email,
                    data: {
                      name: firstName,
                      activationDeadline: format(activationDeadline, "MMMM d, yyyy"),
                    },
                  },
                });
              } catch (emailError) {
                console.error(`Failed to send approval email to ${app.email}:`, emailError);
              }
            }
            continue;
          }
          
          // Look up user_id by email
          const { data: userData } = await supabase
            .from("profiles")
            .select("user_id")
            .ilike("email", app.email)
            .maybeSingle();
          
          // Create member record
          try {
            await supabase
              .from("members")
              .insert({
                first_name: firstName,
                last_name: lastName,
                email: app.email,
                phone: app.phone,
                membership_type: normalizeTierName(app.membership_plan),
                status: "pending_activation",
                approved_at: now.toISOString(),
                activation_deadline: activationDeadline.toISOString(),
                user_id: userData?.user_id || null,
                is_founding_member: app.founding_member?.toLowerCase() === "yes",
                gender: gender,
                stripe_customer_id: app.stripe_customer_id || null,
              } as any);
          } catch (memberError) {
            console.error(`Failed to create member for ${app.email}:`, memberError);
          }
          
          // Send approval email only if not suppressed
          if (!suppressEmail) {
            try {
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "application_approved",
                  to: app.email,
                  data: {
                    name: firstName,
                    activationDeadline: format(activationDeadline, "MMMM d, yyyy"),
                  },
                },
              });
            } catch (emailError) {
              console.error(`Failed to send approval email to ${app.email}:`, emailError);
            }
          }
        }
        
        if (skippedCount > 0) {
          toast.warning(`${skippedCount} member(s) already existed and were skipped.`);
        }
      }
    },
    onSuccess: (_, { ids, status, suppressEmail }) => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      if (status === "approved") {
        if (suppressEmail) {
          toast.success(`${ids.length} application(s) approved, members created (emails suppressed)`);
        } else {
          toast.success(`${ids.length} application(s) approved, members created & emails sent`);
        }
      } else {
        toast.success(`${ids.length} application(s) marked as ${status}`);
      }
      setSelectedIds(new Set());
    },
    onError: () => {
      toast.error("Failed to update applications");
    },
  });

  // Batch auto-activation handler
  const handleBatchAutoActivate = async (config: BatchActivationConfig) => {
    setIsBatchActivating(true);
    
    try {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expired. Please log in again.");
      }

      const { startDate, chargeUnpaidAnnualFees, applicationsToActivate, skippedApplications } = config;
      let successCount = 0;
      let chargedCount = 0;
      let failedCharges: string[] = [];
      
      for (const app of applicationsToActivate) {
        const needsCharge = app.annual_fee_status !== "paid" && app.stripe_customer_id && chargeUnpaidAnnualFees;
        
        // Charge annual fee if needed
        if (needsCharge) {
          try {
            const gender = app.gender?.toLowerCase();
            const annualFeeAmount = (gender === "men" || gender === "male") ? 175 : 300;
            
            const { data, error } = await supabase.functions.invoke("stripe-payment", {
              body: {
                action: "charge_saved_card",
                stripeCustomerId: app.stripe_customer_id,
                applicantName: app.full_name,
                applicationId: app.id,
                amount: annualFeeAmount * 100, // cents
                description: "Annual Membership Fee",
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            
            if (error || data?.error) {
              console.error("Failed to charge annual fee for:", app.email, error || data?.error);
              failedCharges.push(app.full_name);
              continue; // Skip this application
            }
            
            // Update application annual fee status
            await supabase
              .from("membership_applications")
              .update({ annual_fee_status: "paid" })
              .eq("id", app.id);
            
            chargedCount++;
          } catch (chargeErr) {
            console.error("Charge error for:", app.email, chargeErr);
            failedCharges.push(app.full_name);
            continue;
          }
        }
        
        // Now approve and auto-activate
        try {
          await updateStatusMutation.mutateAsync({
            id: app.id,
            status: "approved",
            application: app,
            suppressEmail: false, // Send welcome email
            autoActivate: true,
            startDate: startDate,
          });
          successCount++;
        } catch (err) {
          console.error("Failed to auto-activate:", app.email, err);
        }
      }
      
      // Show results
      if (successCount > 0) {
        toast.success(`Successfully activated ${successCount} member(s)`);
      }
      if (chargedCount > 0) {
        toast.info(`Charged annual fee for ${chargedCount} member(s)`);
      }
      if (failedCharges.length > 0) {
        toast.error(`Failed to charge: ${failedCharges.join(", ")}`);
      }
      if (skippedApplications.length > 0) {
        toast.warning(`${skippedApplications.length} application(s) skipped (no card or unpaid)`);
      }
      
      setShowBatchActivationDialog(false);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
    } catch (err) {
      console.error("Batch activation error:", err);
      toast.error("Failed to complete batch activation");
    } finally {
      setIsBatchActivating(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredApplications.map((app) => app.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = (status: string) => {
    if (selectedIds.size === 0) {
      toast.error("No applications selected");
      return;
    }
    setPendingBulkAction(status);
  };

  const confirmBulkAction = (suppressEmail = false) => {
    if (pendingBulkAction) {
      bulkUpdateMutation.mutate({ 
        ids: Array.from(selectedIds), 
        status: pendingBulkAction,
        suppressEmail 
      });
      setPendingBulkAction(null);
    }
  };

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Membership Applications">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (isError) {
    return (
      <AdminLayout title="Membership Applications">
        <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load applications</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {(error as Error)?.message || "An unexpected error occurred while fetching applications."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Membership Applications">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-3xl font-bold">{pendingCount}</p>
                </div>
                <Clock className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-3xl font-bold">{approvedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                  <p className="text-3xl font-bold">{applications.length}</p>
                </div>
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
            <Button variant={statusFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("pending")}>Pending</Button>
            <Button variant={statusFilter === "approved" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("approved")}>Approved</Button>
            <Button variant={statusFilter === "rejected" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("rejected")}>Rejected</Button>
            <Button variant={statusFilter === "cancelled" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("cancelled")}>Cancelled</Button>
            <Button variant={statusFilter === "abandoned" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("abandoned")} className="border-destructive/30 text-destructive hover:bg-destructive/10">
              <AlertCircle className="h-3 w-3 mr-1" />
              Abandoned
              {abandonedCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium">
                  {abandonedCount}
                </span>
              )}
            </Button>

            <Button
              variant={statusFilter === "card_declined" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("card_declined")}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <CreditCard className="h-3 w-3 mr-1" />
              Card Declined{cardDeclinedCount > 0 && ` (${cardDeclinedCount})`}
            </Button>
            <div className="h-6 w-px bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Date Range & Plan Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearDateFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
          <div className="h-6 w-px bg-border mx-1" />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">All Plans</option>
            {membershipPlans.map((plan) => (
              <option key={plan} value={plan}>
                {plan.split(" –")[0]}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="flex gap-2">
                  {/* Approve dropdown with options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" disabled={bulkUpdateMutation.isPending}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleBulkAction("approved")}>
                        <Send className="h-4 w-4 mr-2" />
                        Approve & Send Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setPendingBulkAction("approved_no_email");
                      }}>
                        <MailX className="h-4 w-4 mr-2" />
                        Approve (No Email)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowBatchActivationDialog(true)}>
                        <Zap className="h-4 w-4 mr-2" />
                        Approve & Auto-Activate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="destructive" onClick={() => handleBulkAction("rejected")} disabled={bulkUpdateMutation.isPending}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkAction("cancelled")} disabled={bulkUpdateMutation.isPending}>
                    <Ban className="h-4 w-4 mr-1" />
                    Cancel All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch Activation Dialog */}
        <BatchActivationDialog
          open={showBatchActivationDialog}
          onOpenChange={setShowBatchActivationDialog}
          applications={applications.filter(app => selectedIds.has(app.id) && app.status === "pending")}
          onConfirm={handleBatchAutoActivate}
          isLoading={isBatchActivating}
        />

        {/* Personalized Letter Modal */}
        <PersonalizedLetterModal
          open={showPersonalizedLetterModal}
          onOpenChange={setShowPersonalizedLetterModal}
          applicant={personalizedLetterTarget ? {
            id: personalizedLetterTarget.id,
            name: personalizedLetterTarget.first_name || personalizedLetterTarget.full_name.split(" ")[0],
            email: personalizedLetterTarget.email,
            tier: personalizedLetterTarget.membership_plan,
            wellness_goals: personalizedLetterTarget.wellness_goals,
            services_interested: personalizedLetterTarget.services_interested,
            holistic_wellness: personalizedLetterTarget.holistic_wellness || undefined,
            lifestyle_integration: personalizedLetterTarget.lifestyle_integration || undefined,
          } : null}
          isAlreadyApproved={personalizedLetterTarget?.status === "approved"}
          onSendSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
            setPersonalizedLetterTarget(null);
          }}
          onApproveAfterSend={async (applicantId: string) => {
            // This is called ONLY after email is successfully sent
            const app = applications.find(a => a.id === applicantId);
            if (!app) return;
            
            await updateStatusMutation.mutateAsync({
              id: applicantId,
              status: "approved",
              application: app,
              suppressEmail: true, // Don't send another email, we just sent the personalized one
            });
          }}
        />

        {/* Bulk Action Confirmation Dialog */}
        <AlertDialog open={!!pendingBulkAction} onOpenChange={() => setPendingBulkAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingBulkAction === "approved_no_email" ? (
                  <>
                    Are you sure you want to approve {selectedIds.size} application(s) <strong>without sending emails</strong>?
                    Members will be created with "pending_activation" status.
                  </>
                ) : (
                  <>
                    Are you sure you want to mark {selectedIds.size} application(s) as <strong>{pendingBulkAction}</strong>? 
                    This action cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (pendingBulkAction === "approved_no_email") {
                  bulkUpdateMutation.mutate({ 
                    ids: Array.from(selectedIds), 
                    status: "approved",
                    suppressEmail: true 
                  });
                  setPendingBulkAction(null);
                } else {
                  confirmBulkAction(false);
                }
              }}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Application Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
          if (!open) {
            setShowDeleteDialog(false);
            setApplicationToDelete(null);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Application</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the application for <strong>{applicationToDelete?.full_name || applicationToDelete?.first_name}</strong>.
                <br /><br />
                This action cannot be undone. The following related data will also be deleted:
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>Application status history</li>
                  <li>Associated charge records</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (applicationToDelete) {
                    deleteApplicationMutation.mutate(applicationToDelete.id);
                  }
                }}
                disabled={deleteApplicationMutation.isPending}
              >
                {deleteApplicationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Abandoned Applications Tab */}
        {statusFilter === "abandoned" ? (
          <Card>
            <CardHeader>
              <CardTitle>Abandoned Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <AbandonedApplicationsTab />
            </CardContent>
          </Card>
        ) : (
        /* Applications Table */
        <Card>
          <CardHeader>
            <CardTitle>Applications ({filteredApplications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredApplications.length > 0 && selectedIds.size === filteredApplications.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Founding Member</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email Sent</TableHead>
                  <TableHead>Initiation Fee</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(app.id)}
                        onCheckedChange={(checked) => handleSelectOne(app.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{app.full_name}</p>
                        <p className="text-sm text-muted-foreground">{app.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatTierDisplay(app.membership_plan)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {app.founding_member?.toLowerCase() === "yes" && (
                          <Badge className="bg-accent/20 text-accent-foreground dark:bg-accent/30 dark:text-accent">
                            Founding
                          </Badge>
                        )}
                      </div>

                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.stripe_customer_id ? (
                          <Badge className="bg-muted/20 text-muted-foreground dark:bg-muted/30 dark:text-muted-foreground">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {app.card_brand && app.card_last4 
                              ? `${app.card_brand.toUpperCase()} •••• ${app.card_last4}`
                              : "On File"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            None
                          </Badge>
                        )}
                        {/* Payment link sent indicator */}
                        {app.payment_link_sent_at && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                                  <Link2 className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Sent</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Payment link sent on {format(new Date(app.payment_link_sent_at), "MMM d, yyyy 'at' h:mm a")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell>
                      {(() => {
                        const emailInfo = emailStatusByApplication.get(app.id);
                        if (!emailInfo) {
                          // No email sent for this application
                          if (app.status === "approved") {
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-destructive border-destructive gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      No Email
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Approved but no email was sent</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }
                          return <span className="text-muted-foreground text-xs">—</span>;
                        }
                        
                        // Special-case: card-decline notice should pop visually
                        if (emailInfo.type === "application_card_declined") {
                          const failed = emailInfo.status === "failed";
                          const declineCount = cardDeclineHistoryByApp.get(app.id)?.length || 1;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={`gap-1 ${failed ? "bg-destructive text-destructive-foreground border-destructive" : "text-destructive border-destructive bg-destructive/10"}`}
                                  >
                                    <CreditCard className="h-3 w-3" />
                                    {failed ? "Decline Email Failed" : "Card Declined Notice"}
                                    {declineCount > 1 && ` ×${declineCount}`}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {failed ? "Email failed to send" : "Card-decline notice sent"}{" "}
                                    {emailInfo.sentAt ? format(new Date(emailInfo.sentAt), "MMM d 'at' h:mm a") : "recently"}
                                  </p>
                                  {failed && emailInfo.errorMessage && (
                                    <p className="text-xs mt-1 opacity-80">{emailInfo.errorMessage}</p>
                                  )}
                                  {declineCount > 1 && (
                                    <p className="text-xs mt-1 opacity-80">{declineCount} total attempts</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        // Format email type for display
                        const typeLabels: Record<string, string> = {
                          "approval_letter_personalized": "AI Letter",
                          "approval_letter": "Approval",
                          "approval_with_deadline": "Deadline",
                          "setup_instructions": "Setup",
                          "application_approved_locked_date": "Locked Date",
                        };
                        const label = typeLabels[emailInfo.type] || emailInfo.type;

                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-muted/20 text-muted-foreground gap-1">
                                  <Mail className="h-3 w-3" />
                                  {label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Sent {emailInfo.sentAt ? format(new Date(emailInfo.sentAt), "MMM d 'at' h:mm a") : "recently"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{getAnnualFeeBadge(app.annual_fee_status)}</TableCell>
                    <TableCell>{format(new Date(app.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenApplication(app)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {/* Charge Card - only when payment method exists */}
                          {app.stripe_customer_id && (
                            <DropdownMenuItem onClick={() => openChargeDialog(app)}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Charge Card
                            </DropdownMenuItem>
                          )}
                          
                          {/* Add/Update Payment Method - always available */}
                          <DropdownMenuItem 
                            onClick={() => handleAddApplicantCard(app)}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            {app.stripe_customer_id ? "Update Payment Method" : "Add Payment Method"}
                          </DropdownMenuItem>
                          
                          {/* Request Payment Info - available for pending/approved apps */}
                          {(app.status === "pending" || app.status === "approved") && (
                            <DropdownMenuItem 
                              onClick={() => handleRequestPaymentInfo(app)}
                              disabled={isRequestingPayment}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Request Payment Info
                            </DropdownMenuItem>
                          )}
                          
                          {/* Generate Payment Link - for annual fee not yet paid */}
                          {app.annual_fee_status !== "paid" && (app.status === "pending" || app.status === "approved") && (
                            <DropdownMenuItem 
                              onClick={() => handleGeneratePaymentLink(app)}
                              disabled={isGeneratingLink}
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              {isGeneratingLink ? "Generating..." : "Generate Payment Link"}
                            </DropdownMenuItem>
                          )}
                          
                          {/* Approval options - only for non-approved apps */}
                          {app.status !== "approved" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved", application: app, suppressEmail: true })}
                              >
                                <MailX className="h-4 w-4 mr-2" />
                                Approve (No Email)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved", application: app, isPreLaunch: true })}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Approve + Approval Letter
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  // Open modal ONLY - approval happens after email is sent successfully
                                  setPersonalizedLetterTarget(app);
                                  setShowPersonalizedLetterModal(true);
                                }}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Approve + AI Personalized Letter ✨
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-muted-foreground"
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved", application: app })}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Approve + Deadline Email (7-Day Selection)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  // Send setup_instructions email
                                  updateStatusMutation.mutate({ id: app.id, status: "approved", application: app, suppressEmail: true });
                                  // Then send the setup email
                                  supabase.functions.invoke("send-email", {
                                    body: {
                                      type: "setup_instructions",
                                      to: app.email,
                                      data: {
                                        name: app.first_name || app.full_name.split(" ")[0],
                                        email: app.email,
                                        membershipTier: app.membership_plan,
                                      },
                                    },
                                  }).then(() => {
                                    toast.success("Application approved & setup email sent");
                                  }).catch((err) => {
                                    console.error("Failed to send setup email:", err);
                                    toast.error("Approved but failed to send setup email");
                                  });
                                }}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Approve + Setup Instructions
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-primary"
                                onClick={() => openSingleActivationDialog(app)}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Approve & Auto-Activate
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSingleActivationTarget(app);
                                  setShowLockedDateDialog(true);
                                }}
                              >
                                <CalendarIcon className="h-4 w-4 mr-2" />
                                Approve with Locked Start Date
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Resend Email options - only for already approved applications */}
                          {app.status === "approved" && (
                            <>
                              <DropdownMenuSeparator />
                              {/* Payment request options for unpaid initiation fee */}
                              {app.annual_fee_status !== "paid" && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => handleSendPaymentRequest(app)}
                                    disabled={isSendingPaymentRequest}
                                  >
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Request Initiation Fee
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleSendFinalNotice(app)}
                                    disabled={isSendingFinalNotice}
                                    className="text-destructive"
                                  >
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    Send Final Notice
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem 
                                onClick={() => {
                                  // Open personalized letter modal for resend
                                  setPersonalizedLetterTarget(app);
                                  setShowPersonalizedLetterModal(true);
                                }}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Send AI Personalized Letter
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={async () => {
                                  try {
                                    const firstName = app.first_name || app.full_name.split(" ")[0];
                                    await supabase.functions.invoke("send-email", {
                                      body: {
                                        type: "approval_letter",
                                        to: app.email,
                                        data: {
                                          name: firstName,
                                          membershipTier: app.membership_plan,
                                        },
                                      },
                                    });
                                    // Log to audit
                                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                                    if (currentUser) {
                                      await supabase.from("email_audit_log" as any).insert({
                                        email_type: "approval_letter",
                                        recipient_email: app.email,
                                        recipient_name: firstName,
                                        triggered_by: currentUser.id,
                                        trigger_source: "admin_resend",
                                        application_id: app.id,
                                        status: "sent",
                                        sent_at: new Date().toISOString(),
                                      });
                                    }
                                    queryClient.invalidateQueries({ queryKey: ["email-audit-applications"] });
                                    toast.success("Approval letter sent!");
                                  } catch (err) {
                                    console.error("Failed to send approval letter:", err);
                                    toast.error("Failed to send email");
                                  }
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Send Standard Approval Letter
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={async () => {
                                  try {
                                    const firstName = app.first_name || app.full_name.split(" ")[0];
                                    await supabase.functions.invoke("send-email", {
                                      body: {
                                        type: "setup_instructions",
                                        to: app.email,
                                        data: {
                                          name: firstName,
                                          email: app.email,
                                          membershipTier: app.membership_plan,
                                        },
                                      },
                                    });
                                    // Log to audit
                                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                                    if (currentUser) {
                                      await supabase.from("email_audit_log" as any).insert({
                                        email_type: "setup_instructions",
                                        recipient_email: app.email,
                                        recipient_name: firstName,
                                        triggered_by: currentUser.id,
                                        trigger_source: "admin_resend",
                                        application_id: app.id,
                                        status: "sent",
                                        sent_at: new Date().toISOString(),
                                      });
                                    }
                                    queryClient.invalidateQueries({ queryKey: ["email-audit-applications"] });
                                    toast.success("Setup instructions sent!");
                                  } catch (err) {
                                    console.error("Failed to send setup instructions:", err);
                                    toast.error("Failed to send email");
                                  }
                                }}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Send Setup Instructions
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={async () => {
                                  try {
                                    const firstName = app.first_name || app.full_name.split(" ")[0];
                                    await supabase.functions.invoke("send-email", {
                                      body: {
                                        type: "pwa_reinstall_instructions",
                                        to: app.email,
                                        data: {
                                          name: firstName,
                                        },
                                      },
                                    });
                                    // Log to audit
                                    const { data: { user: currentUser } } = await supabase.auth.getUser();
                                    if (currentUser) {
                                      await supabase.from("email_audit_log" as any).insert({
                                        email_type: "pwa_reinstall_instructions",
                                        recipient_email: app.email,
                                        recipient_name: firstName,
                                        triggered_by: currentUser.id,
                                        trigger_source: "admin_resend",
                                        application_id: app.id,
                                        status: "sent",
                                        sent_at: new Date().toISOString(),
                                      });
                                    }
                                    queryClient.invalidateQueries({ queryKey: ["email-audit-applications"] });
                                    toast.success("PWA reinstall instructions sent!");
                                  } catch (err) {
                                    console.error("Failed to send PWA reinstall instructions:", err);
                                    toast.error("Failed to send email");
                                  }
                                }}
                              >
                                <Smartphone className="h-4 w-4 mr-2" />
                                Send PWA Reinstall Instructions
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => sendApplicationCardDeclinedEmail(app)}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Resend Card-Decline Notice
                              </DropdownMenuItem>
                            </>
                          )}
                          {app.status !== "rejected" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "rejected" })}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          )}
                          {app.status !== "cancelled" && (
                            <DropdownMenuItem className="text-muted-foreground" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "cancelled" })}>
                              <Ban className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setApplicationToDelete(app);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Application Detail Sheet (Full-Width Side Panel) */}
        <Sheet open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <SheetContent side="right" className="w-screen sm:!max-w-none p-6 sm:p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
            <SheetHeader>
              <SheetTitle>Application Details</SheetTitle>
              <SheetDescription>
                Submitted on {selectedApplication && format(new Date(selectedApplication.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </SheetDescription>
            </SheetHeader>
            {selectedApplication && (
              <div className="space-y-6 mt-4">
                  {/* Personal Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">First Name</p>
                        <p className="font-medium">{selectedApplication.first_name || selectedApplication.full_name?.split(" ")[0] || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Name</p>
                        <p className="font-medium">{selectedApplication.last_name || selectedApplication.full_name?.split(" ").slice(1).join(" ") || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date of Birth</p>
                        <p className="font-medium">{selectedApplication.date_of_birth ? format(new Date(selectedApplication.date_of_birth), "MMMM d, yyyy") : "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Gender</p>
                        <p className="font-medium">{selectedApplication.gender || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedApplication.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedApplication.phone}</p>
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-medium">
                          {selectedApplication.address}, {selectedApplication.city}, {selectedApplication.state} {selectedApplication.zip_code}
                          {selectedApplication.country && selectedApplication.country !== "US" && `, ${selectedApplication.country}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Membership Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Membership</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Membership Plan</p>
                        <p className="font-medium">{selectedApplication.membership_plan}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        {getStatusBadge(selectedApplication.status)}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Founding Member</p>
                        {selectedApplication.founding_member?.toLowerCase() === "yes" ? (
                          <Badge className="bg-accent/20 text-accent-foreground dark:bg-accent/30 dark:text-accent">Founding</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Liability Waiver</p>
                        {waiverRecord?.waiver_signed || selectedApplication.liability_waiver_signed ? (
                          <Badge variant="outline" className="text-green-600 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Signed
                            {waiverRecord?.waiver_signed_at
                              ? ` · ${format(new Date(waiverRecord.waiver_signed_at), "MMM d, yyyy")}`
                              : ""}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not signed</span>
                        )}

                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Previous Member</p>
                        <p className="font-medium">{selectedApplication.previous_member || "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Referred By</p>
                        <p className="font-medium">{selectedApplication.referred_by_member || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Annual Fee ($300)</p>
                        {getAnnualFeeBadge(selectedApplication.annual_fee_status)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Wellness Profile */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Wellness Profile</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Wellness Goals</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedApplication.wellness_goals?.map((goal) => (
                            <Badge key={goal} variant="outline">{goal}</Badge>
                          ))}
                          {(!selectedApplication.wellness_goals || selectedApplication.wellness_goals.length === 0) && (
                            <span className="text-sm text-muted-foreground">None specified</span>
                          )}
                        </div>
                        {selectedApplication.other_goals && (
                          <p className="text-sm mt-2"><span className="text-muted-foreground">Other goals:</span> {selectedApplication.other_goals}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Motivations</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedApplication.motivations?.map((motivation) => (
                            <Badge key={motivation} variant="outline">{motivation}</Badge>
                          ))}
                          {(!selectedApplication.motivations || selectedApplication.motivations.length === 0) && (
                            <span className="text-sm text-muted-foreground">None specified</span>
                          )}
                        </div>
                        {selectedApplication.other_motivation && (
                          <p className="text-sm mt-2"><span className="text-muted-foreground">Other motivation:</span> {selectedApplication.other_motivation}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Services Interested</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedApplication.services_interested?.map((service) => (
                            <Badge key={service} variant="outline">{service}</Badge>
                          ))}
                          {(!selectedApplication.services_interested || selectedApplication.services_interested.length === 0) && (
                            <span className="text-sm text-muted-foreground">None specified</span>
                          )}
                        </div>
                        {selectedApplication.other_services && (
                          <p className="text-sm mt-2"><span className="text-muted-foreground">Other services:</span> {selectedApplication.other_services}</p>
                        )}
                      </div>

                      {selectedApplication.holistic_wellness && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Holistic Wellness Goals</p>
                          <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedApplication.holistic_wellness}</p>
                        </div>
                      )}

                      {selectedApplication.lifestyle_integration && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Lifestyle Integration</p>
                          <p className="text-sm bg-muted/50 rounded-lg p-3">{selectedApplication.lifestyle_integration}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Payment & Card Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Information</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Stripe Customer</p>
                        <p className="font-medium">{selectedApplication.stripe_customer_id ? "Connected" : "Not connected"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Card on File</p>
                        {selectedApplication.card_last4 ? (
                          <p className="font-medium flex items-center gap-1">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{selectedApplication.card_brand}</span> •••• {selectedApplication.card_last4}
                            {selectedApplication.card_exp_month && selectedApplication.card_exp_year && (
                              <span className="text-muted-foreground ml-1">({selectedApplication.card_exp_month}/{selectedApplication.card_exp_year})</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">No card</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payment Info Provided</p>
                        <p className="font-medium">{selectedApplication.payment_info_provided ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Agreements */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agreements & Acknowledgments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        {selectedApplication.membership_agreement_signed ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm">Membership Agreement Signed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedApplication.one_year_commitment ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm">One-Year Commitment Acknowledged</span>
                      </div>
                      {(() => {
                        const isLegacy = selectedApplication.credit_card_auth === true && selectedApplication.ack_initiation_fee !== true;
                        if (isLegacy) {
                          return (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-primary" />
                              <span className="text-sm text-muted-foreground">Acknowledged on legacy form</span>
                            </div>
                          );
                        }
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              {selectedApplication.ack_initiation_fee ? (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-sm">Initiation Fee Acknowledged</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedApplication.ack_card_on_file ? (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-sm">Card-on-File Acknowledged</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedApplication.ack_final_readiness ? (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-sm">Final Readiness Confirmed</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <Separator />

                  {/* Admin Notes */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <StickyNote className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Admin Notes</h3>
                    </div>
                    <Textarea
                      placeholder="Add your notes about this application..."
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      className="min-h-[100px] mb-3"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => updateNotesMutation.mutate({ id: selectedApplication.id, notes: notesValue })}
                      disabled={updateNotesMutation.isPending}
                    >
                      {updateNotesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Save Notes
                    </Button>
                  </div>

                  {/* Status History */}
                  <ApplicationStatusHistorySection applicationId={selectedApplication.id} />

                  {/* Charge History */}
                  <div className="pt-4 border-t">
                    <ChargeHistory 
                      applicationId={selectedApplication.id} 
                      isAdmin={true}
                      recipientEmail={selectedApplication.email}
                      recipientName={selectedApplication.first_name || selectedApplication.full_name.split(" ")[0]}
                    />
                  </div>

                  {/* Card-Decline Email — always visible for approved applicants */}
                  {(() => {
                    const history = cardDeclineHistoryByApp.get(selectedApplication.id) || [];
                    const hasHistory = history.length > 0;
                    return (
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <CreditCard className={`h-4 w-4 ${hasHistory ? "text-destructive" : ""}`} />
                            Card-Decline Email{hasHistory ? ` (${history.length})` : ""}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendApplicationCardDeclinedEmail(selectedApplication)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            {hasHistory ? "Resend now" : "Send Card-Decline Email"}
                          </Button>
                        </div>
                        {hasHistory ? (
                          <div className="space-y-1.5 text-sm">
                            {history.map((entry, idx) => (
                              <div
                                key={idx}
                                className={`flex items-start justify-between gap-3 p-2 rounded border ${
                                  entry.status === "failed"
                                    ? "border-destructive/40 bg-destructive/5"
                                    : "border-border bg-muted/30"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={
                                        entry.status === "failed"
                                          ? "text-destructive border-destructive"
                                          : "text-foreground"
                                      }
                                    >
                                      {entry.status === "failed" ? "Failed" : "Sent"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {entry.sentAt ? format(new Date(entry.sentAt), "MMM d, yyyy 'at' h:mm a") : "—"}
                                    </span>
                                  </div>
                                  {entry.errorMessage && (
                                    <p className="text-xs text-destructive mt-1 break-all">{entry.errorMessage}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No card-decline notice sent yet. Use the button above to send one manually.
                          </p>
                        )}
                      </div>
                    );
                  })()}


                  {/* Initiation Fee Actions */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">Initiation Fee Status</p>
                    <div className="flex gap-2 flex-wrap mb-3">
                      <Button 
                        size="sm" 
                        variant={selectedApplication.annual_fee_status === "paid" ? "default" : "outline"}
                        onClick={() => {
                          setMarkPaidTarget(selectedApplication);
                          setShowMarkPaidDialog(true);
                        }}
                        disabled={selectedApplication.annual_fee_status === "paid"}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Mark as Paid
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedApplication.annual_fee_status === "pending" ? "default" : "outline"}
                        onClick={() => updateAnnualFeeMutation.mutate({ id: selectedApplication.id, annual_fee_status: "pending" })}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Pending
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedApplication.annual_fee_status === "failed" ? "destructive" : "outline"}
                        onClick={() => updateAnnualFeeMutation.mutate({ id: selectedApplication.id, annual_fee_status: "failed" })}
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Failed
                      </Button>
                    </div>
                    
                    {/* Send Card Request Email */}
                    {selectedApplication.annual_fee_status === "paid" && selectedApplication.status === "approved" && (
                      <div className="mt-3 p-3 border rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-2">
                          Initiation fee is paid. Send email to request card for membership dues:
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const firstName = selectedApplication.first_name || selectedApplication.full_name?.split(" ")[0] || "";
                              await supabase.functions.invoke("send-email", {
                                body: {
                                  type: "add_card_for_dues",
                                  to: selectedApplication.email,
                                  data: { name: firstName },
                                },
                              });
                              toast.success(`Card request email sent to ${firstName}`);
                            } catch (error) {
                              console.error("Failed to send card request email:", error);
                              toast.error("Failed to send email");
                            }
                          }}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Send Card Request Email
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Member Link Status (for approved applications) */}
                  {selectedApplication.status === "approved" && memberLinkStatus && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-3">Member Account Status</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          {memberLinkStatus.hasUser ? (
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>User account {memberLinkStatus.hasUser ? "exists" : "not created yet"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {memberLinkStatus.hasMember ? (
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>Member record {memberLinkStatus.hasMember ? "exists" : "not created"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {memberLinkStatus.memberLinked ? (
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <XCircle className="h-4 w-4 text-accent" />
                          )}
                          <span>Account linked: {memberLinkStatus.memberLinked ? "Yes" : "No"}</span>
                        </div>
                      </div>
                      {memberLinkStatus.hasUser && memberLinkStatus.hasMember && !memberLinkStatus.memberLinked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={async () => {
                            const { data: member } = await supabase
                              .from("members")
                              .select("id")
                              .ilike("email", selectedApplication.email)
                              .maybeSingle();
                            if (member) {
                              linkMemberMutation.mutate({ memberId: member.id, email: selectedApplication.email });
                            } else {
                              toast.error("Member record not found");
                            }
                          }}
                          disabled={linkMemberMutation.isPending}
                        >
                          {linkMemberMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4 mr-1" />
                          )}
                          Link Member to User Account
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Application Status Actions */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">Update Application Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedApplication.status !== "approved" && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => updateStatusMutation.mutate({ 
                              id: selectedApplication.id, 
                              status: "approved", 
                              application: selectedApplication 
                            })}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Approve & Send Email
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ 
                              id: selectedApplication.id, 
                              status: "approved", 
                              application: selectedApplication,
                              suppressEmail: true 
                            })}
                          >
                            <MailX className="h-4 w-4 mr-1" />
                            Approve (No Email)
                          </Button>
                        </>
                      )}
                      {selectedApplication.status !== "rejected" && (
                        <Button size="sm" variant="destructive" onClick={() => updateStatusMutation.mutate({ id: selectedApplication.id, status: "rejected" })}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      )}
                      {selectedApplication.status !== "cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedApplication.id, status: "cancelled" })}>
                          <Ban className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
            )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Enhanced Charge Card Dialog */}
        <Dialog open={showChargeDialog} onOpenChange={(open) => {
          if (!open) {
            setShowChargeDialog(false);
            setChargeSuccessData(null);
            setShowAddCardForm(false);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {chargeSuccessData ? "✅ Charge Successful" : "Charge Card"}
              </DialogTitle>
              <DialogDescription>
                {chargeSuccessData 
                  ? `Charged $${chargeSuccessData.amount} to ${chargeSuccessData.cardBrand} •••• ${chargeSuccessData.cardLast4}`
                  : `Charge ${chargeTarget?.full_name}'s saved card`
                }
              </DialogDescription>
            </DialogHeader>

            {chargeSuccessData ? (
              /* Post-Charge Success View */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Initiation fee marked as paid</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Member profile synced (if exists)</span>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium">What's Next?</p>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="approve-email"
                      checked={afterChargeOptions.approveAndSendEmail}
                      onCheckedChange={(checked) => setAfterChargeOptions(prev => ({ ...prev, approveAndSendEmail: !!checked, autoActivate: false }))}
                    />
                    <label htmlFor="approve-email" className="text-sm">Approve & send email</label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="auto-activate"
                      checked={afterChargeOptions.autoActivate}
                      onCheckedChange={(checked) => setAfterChargeOptions(prev => ({ ...prev, autoActivate: !!checked, approveAndSendEmail: false }))}
                    />
                    <label htmlFor="auto-activate" className="text-sm">Auto-activate member</label>
                  </div>
                  
                  {afterChargeOptions.autoActivate && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-6">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {format(afterChargeOptions.activationDate, "MMM d, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={afterChargeOptions.activationDate}
                          onSelect={(date) => date && setAfterChargeOptions(prev => ({ ...prev, activationDate: date }))}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowChargeDialog(false); setChargeSuccessData(null); }}>
                    Done
                  </Button>
                  {(afterChargeOptions.approveAndSendEmail || afterChargeOptions.autoActivate) && (
                    <Button onClick={handleExecutePostChargeActions}>
                      <Zap className="h-4 w-4 mr-2" />
                      Execute Actions
                    </Button>
                  )}
                </div>
              </div>
            ) : showAddCardForm && addCardClientSecret ? (
              /* Add Card Form */
              <StripeProvider clientSecret={addCardClientSecret}>
                <AdminAddCardForm 
                  onSuccess={handleCardSaved}
                  onCancel={() => { 
                    setShowAddCardForm(false); 
                    setAddCardClientSecret(null); 
                    setAddCardCustomerId(null);
                  }}
                  applicationId={chargeTarget?.id}
                  stripeCustomerId={chargeTarget?.stripe_customer_id || addCardCustomerId || undefined}
                />
              </StripeProvider>
            ) : (
              /* Main Charge View */
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Applicant</label>
                  <p className="text-sm text-muted-foreground">{chargeTarget?.full_name} ({chargeTarget?.email})</p>
                </div>

                {/* Card on File Section */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Card on File
                    </span>
                    <Button size="sm" variant="ghost" onClick={handleAddCard} disabled={isLoadingCard}>
                      <Plus className="h-4 w-4 mr-1" />
                      {cardDetails ? "Replace" : "Add Card"}
                    </Button>
                  </div>
                  
                  {isLoadingCard ? (
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ) : cardDetails ? (
                    <div className="flex items-center gap-3 text-sm">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <span className="capitalize font-medium">{cardDetails.brand}</span>
                      <span>•••• {cardDetails.last4}</span>
                      <span className="text-muted-foreground">
                        Expires {cardDetails.expMonth}/{cardDetails.expYear}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No card on file</p>
                  )}
                </div>

                <div>
                  <label htmlFor="charge-amount" className="text-sm font-medium">Amount ($)</label>
                  <Input
                    id="charge-amount"
                    type="number"
                    step="0.01"
                    min="0.50"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    placeholder="300.00"
                  />
                </div>
                <div>
                  <label htmlFor="charge-description" className="text-sm font-medium">Description</label>
                  <Input
                    id="charge-description"
                    value={chargeDescription}
                    onChange={(e) => setChargeDescription(e.target.value)}
                    placeholder="Initiation Fee"
                  />
                </div>

                <Separator />

                {/* After Charge Options */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">After Charge</p>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mark-paid" 
                      checked={afterChargeOptions.markInitiationFeePaid}
                      onCheckedChange={(checked) => setAfterChargeOptions(prev => ({ ...prev, markInitiationFeePaid: !!checked }))}
                    />
                    <label htmlFor="mark-paid" className="text-sm">Mark initiation fee as paid</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="sync-member"
                      checked={afterChargeOptions.syncToMemberProfile}
                      onCheckedChange={(checked) => setAfterChargeOptions(prev => ({ ...prev, syncToMemberProfile: !!checked }))}
                    />
                    <label htmlFor="sync-member" className="text-sm">Sync to member profile (prevents double-bill)</label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowChargeDialog(false)} disabled={isCharging}>
                    Cancel
                  </Button>
                  <Button onClick={handleChargeApplicationCard} disabled={isCharging || !cardDetails}>
                    {isCharging ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Charging...
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Charge ${parseFloat(chargeAmount || "0").toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Single Activation Dialog - Immediate Mode */}
        <SingleActivationDialog
          open={showSingleActivationDialog}
          onOpenChange={setShowSingleActivationDialog}
          application={singleActivationTarget}
          onConfirm={handleSingleActivation}
          isLoading={isSingleActivating}
          initialMode="immediate"
          isSuperAdmin={isSuperAdmin()}
        />
        
        {/* Single Activation Dialog - Locked Date Mode */}
        <SingleActivationDialog
          open={showLockedDateDialog}
          onOpenChange={setShowLockedDateDialog}
          application={singleActivationTarget}
          onConfirm={handleSingleActivation}
          isLoading={isSingleActivating}
          initialMode="locked"
          isSuperAdmin={isSuperAdmin()}
        />

        {/* Add Applicant Card Modal */}
        {cardTargetApplication && (
          <AddApplicantCardModal
            open={showAddCardDialog}
            onOpenChange={setShowAddCardDialog}
            onSuccess={() => {
              // Invalidate and immediately refetch for instant UI update
              queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
              queryClient.refetchQueries({ queryKey: ["membership-applications"] });
              setCardTargetApplication(null);
              toast.success("Payment method saved! Dropdown options updated.");
            }}
            applicantEmail={cardTargetApplication.email}
            applicantName={cardTargetApplication.full_name}
            applicationId={cardTargetApplication.id}
          />
        )}

        {/* Payment Link Dialog */}
        <Dialog open={showPaymentLinkDialog} onOpenChange={(open) => {
          setShowPaymentLinkDialog(open);
          if (!open) {
            setPaymentLinkUrl(null);
            setPaymentLinkTarget(null);
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {paymentLinkEmailSent ? (
                  <>
                    <Mail className="h-5 w-5 text-green-600" />
                    Payment Link Emailed
                  </>
                ) : (
                  <>
                    <Link2 className="h-5 w-5" />
                    Payment Link Generated
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {paymentLinkEmailSent 
                  ? `Payment link has been sent to ${paymentLinkEmailAddress}. The applicant has 3 days to complete payment.`
                  : 'Send this link to the applicant to complete their initiation fee payment.'}
              </DialogDescription>
            </DialogHeader>
            
            {paymentLinkTarget && (
              <div className="space-y-4">
                {/* Email Sent Confirmation */}
                {paymentLinkEmailSent && (
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Email sent to <strong>{paymentLinkEmailAddress}</strong> with payment instructions.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Applicant</p>
                    <p className="font-medium">{paymentLinkTarget.full_name || `${paymentLinkTarget.first_name} ${paymentLinkTarget.last_name}`}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{paymentLinkTarget.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium text-lg">
                      ${(paymentLinkTarget.gender?.toLowerCase() === 'male' || paymentLinkTarget.gender?.toLowerCase() === 'men') ? '175' : '300'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gender Pricing</p>
                    <Badge variant="outline">
                      {(paymentLinkTarget.gender?.toLowerCase() === 'male' || paymentLinkTarget.gender?.toLowerCase() === 'men') ? 'Men' : 'Women'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Payment Link (for manual sharing)</p>
                  <div className="flex gap-2">
                    <Input 
                      value={paymentLinkUrl || ""} 
                      readOnly 
                      className="font-mono text-xs"
                    />
                    <Button onClick={handleCopyPaymentLink} variant="outline">
                      Copy
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Per club policy, applicants have 3 days to complete payment. Once payment is completed, their initiation fee status will be automatically updated to "Paid".
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPaymentLinkDialog(false)}>
                    Close
                  </Button>
                  <Button onClick={handleCopyPaymentLink}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Mark as Paid Confirmation Dialog */}
        <MarkPaidDialog
          open={showMarkPaidDialog}
          onOpenChange={(open) => {
            setShowMarkPaidDialog(open);
            if (!open) setMarkPaidTarget(null);
          }}
          applicantName={markPaidTarget ? (markPaidTarget.first_name || markPaidTarget.full_name.split(" ")[0]) : ""}
          feeAmount={markPaidTarget?.gender?.toLowerCase() === "male" ? 175 : 300}
          isLoading={isMarkingPaid}
          onConfirm={async (paymentMethod, note) => {
            if (!markPaidTarget) return;
            setIsMarkingPaid(true);
            try {
              await updateAnnualFeeMutation.mutateAsync({
                id: markPaidTarget.id,
                annual_fee_status: "paid",
                paymentMethod,
                note,
              });
            } finally {
              setIsMarkingPaid(false);
            }
          }}
        />
      </div>
    </AdminLayout>
  );
}

// Application Status History Component
function ApplicationStatusHistorySection({ applicationId }: { applicationId: string }) {
  const { data: history, isLoading } = useApplicationStatusHistory(applicationId);

  if (isLoading) {
    return (
      <div className="pt-4 border-t">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div className="pt-4 border-t">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Status History</p>
      </div>
      <div className="space-y-2">
        {history.map((item, idx) => (
          <div key={item.id} className="flex items-start gap-3 text-sm">
            <div className="flex flex-col items-center mt-1">
              {idx !== history.length - 1 && (
                <div className="w-0.5 h-full bg-border min-h-[24px]" />
              )}
              <div className={`w-2 h-2 rounded-full ${
                item.new_status === 'approved' ? 'bg-success' :
                item.new_status === 'rejected' ? 'bg-destructive' :
                item.new_status === 'cancelled' ? 'bg-muted' :
                'bg-accent'
              }`} />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={
                  item.new_status === 'approved' ? 'bg-success/10 text-success border-success/30' :
                  item.new_status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                  item.new_status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                  'bg-accent/10 text-accent border-accent/30'
                }>
                  {item.new_status}
                </Badge>
                {item.old_status && (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-xs text-muted-foreground">{item.old_status}</span>
                  </>
                )}
              </div>
              {item.notes && (
                <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
