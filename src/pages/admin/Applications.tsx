import { useState } from "react";
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
import { Search, MoreHorizontal, Eye, CheckCircle, XCircle, Clock, Loader2, Ban, DollarSign, AlertCircle, StickyNote, Save, Download, CalendarIcon, X, RefreshCw, Link2, CreditCard, Mail, ChevronDown, Send, Zap, MailX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChargeHistory } from "@/components/ChargeHistory";
import { BatchActivationDialog, BatchActivationConfig } from "@/components/admin/BatchActivationDialog";
import { SingleActivationDialog } from "@/components/admin/SingleActivationDialog";
import { useApplicationStatusHistory } from "@/hooks/useApplicationStatusHistory";
import { History } from "lucide-react";

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
  founding_member: string;
  wellness_goals: string[];
  date_of_birth: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  lifestyle_integration: string | null;
  holistic_wellness: string | null;
  referred_by_member: string;
  services_interested: string[];
  annual_fee_status: string;
  notes: string | null;
  stripe_customer_id: string | null;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [pendingBulkAction, setPendingBulkAction] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [memberLinkStatus, setMemberLinkStatus] = useState<{ hasUser: boolean; hasMember: boolean; memberLinked: boolean } | null>(null);
  
  // Charge dialog state
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [chargeTarget, setChargeTarget] = useState<Application | null>(null);
  const [chargeAmount, setChargeAmount] = useState("300");
  const [chargeDescription, setChargeDescription] = useState("Annual Membership Fee");
  const [isCharging, setIsCharging] = useState(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  
  // Batch activation dialog state
  const [showBatchActivationDialog, setShowBatchActivationDialog] = useState(false);
  const [isBatchActivating, setIsBatchActivating] = useState(false);
  
  // Single activation dialog state
  const [showSingleActivationDialog, setShowSingleActivationDialog] = useState(false);
  const [singleActivationTarget, setSingleActivationTarget] = useState<Application | null>(null);
  const [isSingleActivating, setIsSingleActivating] = useState(false);
  
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
    }: { 
      id: string; 
      status: string; 
      application?: Application;
      suppressEmail?: boolean;
      autoActivate?: boolean;
      startDate?: Date;
      lockedStartDate?: Date;
    }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      
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
        const annualFeePaidAt = autoActivate && application.annual_fee_status === "paid" ? now.toISOString() : null;
        
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
        };
        
        // Add locked_start_date if provided (for locked mode)
        if (lockedStartDate && !autoActivate) {
          memberInsertData.locked_start_date = format(lockedStartDate, "yyyy-MM-dd");
        }
        
        const { error: memberError } = await supabase
          .from("members")
          .insert(memberInsertData);
        
        if (memberError) {
          console.error("Failed to create member record:", memberError);
        }
        
        // Send appropriate email based on options
        if (!suppressEmail) {
          try {
            if (autoActivate) {
              // Send welcome email for auto-activated members
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "membership_activated",
                  to: application.email,
                  data: {
                    name: firstName,
                    membershipType: application.membership_plan,
                    startDate: format(startDate || now, "MMMM d, yyyy"),
                  },
                },
              });
            } else if (lockedStartDate) {
              // Send locked date email
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "application_approved_locked_date",
                  to: application.email,
                  data: {
                    name: firstName,
                    lockedStartDate: format(lockedStartDate, "MMMM d, yyyy"),
                  },
                },
              });
            } else {
              // Send approval email with activation instructions
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "application_approved",
                  to: application.email,
                  data: {
                    name: firstName,
                    activationDeadline: format(activationDeadline, "MMMM d, yyyy"),
                  },
                },
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
    },
    onSuccess: (_, { status, suppressEmail, autoActivate, lockedStartDate }) => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      if (status === "approved") {
        if (autoActivate) {
          toast.success("Application approved & member auto-activated");
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

  const updateAnnualFeeMutation = useMutation({
    mutationFn: async ({ id, annual_fee_status }: { id: string; annual_fee_status: string }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ annual_fee_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success("Annual fee status updated");
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

  const openChargeDialog = (app: Application) => {
    setChargeTarget(app);
    setChargeAmount("300");
    setChargeDescription("Annual Membership Fee");
    setShowChargeDialog(true);
  };

  const openSingleActivationDialog = (app: Application) => {
    setSingleActivationTarget(app);
    setShowSingleActivationDialog(true);
  };

  const handleSingleActivation = async (config: { mode: "immediate" | "locked"; startDate: Date; chargeAnnualFee: boolean }) => {
    if (!singleActivationTarget) return;
    
    setIsSingleActivating(true);
    try {
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
          await supabase.functions.invoke("send-email", {
            body: {
              type: "charge_confirmation",
              to: singleActivationTarget.email,
              data: {
                name: singleActivationTarget.first_name || singleActivationTarget.full_name.split(" ")[0],
                description: "Annual Membership Fee",
                amount: "300.00",
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
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card",
          stripeCustomerId: chargeTarget.stripe_customer_id,
          applicantName: chargeTarget.full_name,
          applicationId: chargeTarget.id,
          amount: Math.round(amountNum * 100), // Convert to cents
          description: chargeDescription,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        toast.success(`Successfully charged $${amountNum.toFixed(2)} to ${chargeTarget.full_name}'s card`);
        
        // Send charge confirmation email
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "charge_confirmation",
              to: chargeTarget.email,
              data: {
                name: chargeTarget.first_name || chargeTarget.full_name.split(" ")[0],
                description: chargeDescription,
                amount: amountNum.toFixed(2),
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
          // Don't fail the charge if email fails
        }
        
        // Update annual fee status if this was an annual fee charge
        if (chargeDescription.toLowerCase().includes("annual") && chargeDescription.toLowerCase().includes("fee")) {
          await supabase
            .from("membership_applications")
            .update({ annual_fee_status: "paid" })
            .eq("id", chargeTarget.id);
          queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
        }
        
        setShowChargeDialog(false);
        setChargeTarget(null);
      } else {
        throw new Error("Charge was not successful");
      }
    } catch (err: any) {
      console.error("Charge error:", err);
      toast.error(err.message || "Failed to charge card");
    } finally {
      setIsCharging(false);
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
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesPlan = planFilter === "all" || app.membership_plan === planFilter;
    
    const appDate = new Date(app.created_at);
    const matchesDateFrom = !dateFrom || !isBefore(appDate, startOfDay(dateFrom));
    const matchesDateTo = !dateTo || !isAfter(appDate, endOfDay(dateTo));
    
    return matchesSearch && matchesStatus && matchesPlan && matchesDateFrom && matchesDateTo;
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;

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

        {/* Applications Table */}
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
                  <TableHead>Annual Fee ($300)</TableHead>
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
                      {app.founding_member?.toLowerCase() === "yes" && (
                        <Badge className="bg-accent/20 text-accent-foreground dark:bg-accent/30 dark:text-accent">
                          Founding
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {app.stripe_customer_id ? (
                        <Badge className="bg-muted/20 text-muted-foreground dark:bg-muted/30 dark:text-muted-foreground">
                          <CreditCard className="h-3 w-3 mr-1" />
                          On File
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          None
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
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
                          {app.stripe_customer_id && (
                            <DropdownMenuItem onClick={() => openChargeDialog(app)}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Charge Card
                            </DropdownMenuItem>
                          )}
                          {!app.stripe_customer_id && (
                            <DropdownMenuItem 
                              onClick={() => handleRequestPaymentInfo(app)}
                              disabled={isRequestingPayment}
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Request Payment Info
                            </DropdownMenuItem>
                          )}
                          {app.status !== "approved" && (
                            <>
                              <DropdownMenuItem 
                                className="text-muted-foreground" 
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved", application: app })}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Approve & Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved", application: app, suppressEmail: true })}
                              >
                                <MailX className="h-4 w-4 mr-2" />
                                Approve (No Email)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-primary"
                                onClick={() => openSingleActivationDialog(app)}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Approve & Auto-Activate
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Application Detail Dialog */}
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>
                Submitted on {selectedApplication && format(new Date(selectedApplication.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 pr-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">First Name</p>
                      <p className="font-medium">{selectedApplication.first_name || selectedApplication.full_name?.split(" ")[0] || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Name</p>
                      <p className="font-medium">{selectedApplication.last_name || selectedApplication.full_name?.split(" ").slice(1).join(" ") || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedApplication.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedApplication.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <p className="font-medium">{selectedApplication.gender || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Membership Plan</p>
                      <p className="font-medium">{selectedApplication.membership_plan}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Founding Member</p>
                      {selectedApplication.founding_member?.toLowerCase() === "yes" ? (
                        <Badge className="bg-accent/20 text-accent-foreground dark:bg-accent/30 dark:text-accent">
                          Founding
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      {getStatusBadge(selectedApplication.status)}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Fee ($300)</p>
                      {getAnnualFeeBadge(selectedApplication.annual_fee_status)}
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedApplication.address}, {selectedApplication.city}, {selectedApplication.state} {selectedApplication.zip_code}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Wellness Goals</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplication.wellness_goals?.map((goal) => (
                        <Badge key={goal} variant="outline">{goal}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Services Interested</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplication.services_interested?.map((service) => (
                        <Badge key={service} variant="outline">{service}</Badge>
                      ))}
                    </div>
                  </div>

                  {selectedApplication.lifestyle_integration && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Lifestyle Integration</p>
                      <p className="text-sm">{selectedApplication.lifestyle_integration}</p>
                    </div>
                  )}

                  {selectedApplication.holistic_wellness && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Holistic Wellness Goals</p>
                      <p className="text-sm">{selectedApplication.holistic_wellness}</p>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <StickyNote className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Admin Notes</p>
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

                  {/* Annual Fee Actions */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">Update Annual Fee Status ($300)</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant={selectedApplication.annual_fee_status === "paid" ? "default" : "outline"}
                        onClick={() => updateAnnualFeeMutation.mutate({ id: selectedApplication.id, annual_fee_status: "paid" })}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Paid
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
                            // Get member ID first
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
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Charge Card Dialog */}
        <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Charge Card</DialogTitle>
              <DialogDescription>
                Charge {chargeTarget?.full_name}'s saved card
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Applicant</label>
                <p className="text-sm text-muted-foreground">{chargeTarget?.full_name} ({chargeTarget?.email})</p>
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
                  placeholder="Annual Membership Fee"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowChargeDialog(false)} disabled={isCharging}>
                  Cancel
                </Button>
                <Button onClick={handleChargeApplicationCard} disabled={isCharging}>
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
          </DialogContent>
        </Dialog>

        {/* Single Activation Dialog */}
        <SingleActivationDialog
          open={showSingleActivationDialog}
          onOpenChange={setShowSingleActivationDialog}
          application={singleActivationTarget}
          onConfirm={handleSingleActivation}
          isLoading={isSingleActivating}
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
