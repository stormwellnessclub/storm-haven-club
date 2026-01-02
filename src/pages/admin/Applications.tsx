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
import { Search, MoreHorizontal, Eye, CheckCircle, XCircle, Clock, Loader2, Ban, DollarSign, AlertCircle, StickyNote, Save, Download, CalendarIcon, X, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

type Application = {
  id: string;
  full_name: string;
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
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
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
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          <DollarSign className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, application }: { id: string; status: string; application?: Application }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      
      // Create member record and send approval email when status is approved
      if (status === "approved" && application) {
        const now = new Date();
        const activationDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        
        // Parse full name into first/last
        const nameParts = application.full_name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        // Check if member already exists for this email (prevent duplicates)
        const { data: existingMember } = await supabase
          .from("members")
          .select("id, email, status, membership_type")
          .ilike("email", application.email)
          .maybeSingle();
        
        if (existingMember) {
          console.log("Member already exists for:", application.email, "status:", existingMember.status);
          toast.warning(`Member record already exists for ${application.email} (status: ${existingMember.status}). Skipping creation.`);
          // Still send approval email if needed
          try {
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
          } catch (emailError) {
            console.error("Failed to send approval email:", emailError);
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
        
        console.log("Member creation - email:", application.email, "found user_id:", userId);
        
        // Create member with pending_activation status
        const { error: memberError } = await supabase
          .from("members")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: application.email,
            phone: application.phone,
            membership_type: application.membership_plan.split(" –")[0], // Extract tier name
            status: "pending_activation",
            approved_at: now.toISOString(),
            activation_deadline: activationDeadline.toISOString(),
            user_id: userId,
          } as any);
        
        if (memberError) {
          console.error("Failed to create member record:", memberError);
          // Don't throw - application status is updated, member creation is secondary
        }
        
        // Send approval email with 7-day activation notice
        try {
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
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success(status === "approved" ? "Application approved, member created & email sent" : "Application status updated");
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
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
      
      // Create member records and send approval emails for bulk approvals
      if (status === "approved") {
        const approvedApps = applications.filter(app => ids.includes(app.id));
        let skippedCount = 0;
        
        for (const app of approvedApps) {
          const now = new Date();
          const activationDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          const nameParts = app.full_name.trim().split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          
          // Check if member already exists for this email (prevent duplicates)
          const { data: existingMember } = await supabase
            .from("members")
            .select("id, email, status")
            .ilike("email", app.email)
            .maybeSingle();
          
          if (existingMember) {
            console.log("Bulk: Member already exists for:", app.email);
            skippedCount++;
            // Still send email
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
                membership_type: app.membership_plan.split(" –")[0],
                status: "pending_activation",
                approved_at: now.toISOString(),
                activation_deadline: activationDeadline.toISOString(),
                user_id: userData?.user_id || null,
              } as any);
          } catch (memberError) {
            console.error(`Failed to create member for ${app.email}:`, memberError);
          }
          
          // Send approval email
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
        
        if (skippedCount > 0) {
          toast.warning(`${skippedCount} member(s) already existed and were skipped.`);
        }
      }
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success(status === "approved" 
        ? `${ids.length} application(s) approved, members created & emails sent` 
        : `${ids.length} application(s) marked as ${status}`);
      setSelectedIds(new Set());
    },
    onError: () => {
      toast.error("Failed to update applications");
    },
  });

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

  const confirmBulkAction = () => {
    if (pendingBulkAction) {
      bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), status: pendingBulkAction });
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
                <Clock className="h-8 w-8 text-amber-500" />
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
                <CheckCircle className="h-8 w-8 text-green-500" />
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
                  <Button size="sm" onClick={() => handleBulkAction("approved")} disabled={bulkUpdateMutation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
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

        {/* Bulk Action Confirmation Dialog */}
        <AlertDialog open={!!pendingBulkAction} onOpenChange={() => setPendingBulkAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark {selectedIds.size} application(s) as <strong>{pendingBulkAction}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBulkAction}>
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
                      <Badge variant="outline">{app.membership_plan.split(" –")[0]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={app.founding_member === "Yes" ? "default" : "secondary"}>
                        {app.founding_member}
                      </Badge>
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
                          {app.status !== "approved" && (
                            <DropdownMenuItem className="text-green-600" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved", application: app })}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {app.status !== "rejected" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "rejected" })}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          )}
                          {app.status !== "cancelled" && (
                            <DropdownMenuItem className="text-gray-600" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "cancelled" })}>
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
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">{selectedApplication.full_name}</p>
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
                      <p className="text-sm text-muted-foreground">Membership Plan</p>
                      <p className="font-medium">{selectedApplication.membership_plan}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Founding Member</p>
                      <Badge variant={selectedApplication.founding_member === "Yes" ? "default" : "secondary"}>
                        {selectedApplication.founding_member}
                      </Badge>
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

                  {/* Application Status Actions */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">Update Application Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedApplication.status !== "approved" && (
                        <Button size="sm" onClick={() => updateStatusMutation.mutate({ id: selectedApplication.id, status: "approved", application: selectedApplication })}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
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
      </div>
    </AdminLayout>
  );
}
