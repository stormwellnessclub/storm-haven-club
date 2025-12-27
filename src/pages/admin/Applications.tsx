import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MoreHorizontal, Eye, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

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
    default:
      return null;
  }
};

export default function Applications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["membership-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("membership_applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] });
      toast.success("Application status updated");
      setSelectedApplication(null);
    },
    onError: () => {
      toast.error("Failed to update application");
    },
  });

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;

  if (isLoading) {
    return (
      <AdminLayout title="Membership Applications">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
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
          <div className="flex gap-2">
            <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
            <Button variant={statusFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("pending")}>Pending</Button>
            <Button variant={statusFilter === "approved" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("approved")}>Approved</Button>
            <Button variant={statusFilter === "rejected" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("rejected")}>Rejected</Button>
          </div>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Applications ({filteredApplications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Founding Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id}>
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
                    <TableCell>{format(new Date(app.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedApplication(app)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {app.status === "pending" && (
                            <>
                              <DropdownMenuItem className="text-green-600" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "approved" })}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => updateStatusMutation.mutate({ id: app.id, status: "rejected" })}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
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

                  {selectedApplication.status === "pending" && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button className="flex-1" onClick={() => updateStatusMutation.mutate({ id: selectedApplication.id, status: "approved" })}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Application
                      </Button>
                      <Button className="flex-1" variant="destructive" onClick={() => updateStatusMutation.mutate({ id: selectedApplication.id, status: "rejected" })}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Application
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
