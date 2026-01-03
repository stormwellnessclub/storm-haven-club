import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CalendarIcon, Check, X, PlayCircle, Snowflake, Search } from "lucide-react";
import { format, isBefore, startOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useAdminFreezeRequests,
  useApproveFreezeRequest,
  useRejectFreezeRequest,
  useActivateFreeze,
  type FreezeRequestWithMember,
} from "@/hooks/useAdminFreezeRequests";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  active: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function FreezeRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FreezeRequestWithMember | null>(null);
  const [approveStartDate, setApproveStartDate] = useState<Date>();
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests, isLoading } = useAdminFreezeRequests(statusFilter);
  const approveRequest = useApproveFreezeRequest();
  const rejectRequest = useRejectFreezeRequest();
  const activateFreeze = useActivateFreeze();

  const filteredRequests = requests?.filter((req) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      req.members.first_name.toLowerCase().includes(query) ||
      req.members.last_name.toLowerCase().includes(query) ||
      req.members.email.toLowerCase().includes(query) ||
      req.members.member_id.toLowerCase().includes(query)
    );
  });

  const handleApprove = (request: FreezeRequestWithMember) => {
    setSelectedRequest(request);
    setApproveStartDate(new Date(request.requested_start_date));
    setShowApproveDialog(true);
  };

  const handleReject = (request: FreezeRequestWithMember) => {
    setSelectedRequest(request);
    setRejectReason("");
    setShowRejectDialog(true);
  };

  const confirmApprove = () => {
    if (!selectedRequest || !approveStartDate) return;
    
    approveRequest.mutate(
      { freezeId: selectedRequest.id, startDate: approveStartDate },
      {
        onSuccess: () => {
          setShowApproveDialog(false);
          setSelectedRequest(null);
        },
      }
    );
  };

  const confirmReject = () => {
    if (!selectedRequest || !rejectReason.trim()) return;
    
    rejectRequest.mutate(
      { freezeId: selectedRequest.id, reason: rejectReason },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setSelectedRequest(null);
        },
      }
    );
  };

  const handleActivate = (request: FreezeRequestWithMember) => {
    activateFreeze.mutate(request.id);
  };

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Snowflake className="h-6 w-6" />
              Freeze Requests
            </h1>
            <p className="text-muted-foreground">
              Manage membership freeze requests
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {pendingCount} Pending
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Requests</CardTitle>
                <CardDescription>
                  Review and manage freeze requests from members
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRequests && filteredRequests.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Requested Dates</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Fee</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {request.members.first_name} {request.members.last_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {request.members.member_id}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{format(new Date(request.requested_start_date), "MMM d, yyyy")}</p>
                                <p className="text-muted-foreground">
                                  to {format(new Date(request.requested_end_date), "MMM d, yyyy")}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {request.duration_months} month{request.duration_months > 1 ? "s" : ""}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">${request.freeze_fee_total}</p>
                                {request.fee_paid && (
                                  <Badge variant="outline" className="text-green-600 border-green-500/20 bg-green-500/10">
                                    Paid
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[request.status]}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(request.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {request.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleApprove(request)}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleReject(request)}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {request.status === 'approved' && request.fee_paid && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleActivate(request)}
                                    disabled={activateFreeze.isPending}
                                  >
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    Activate
                                  </Button>
                                )}
                                {request.status === 'approved' && !request.fee_paid && (
                                  <Badge variant="outline">Awaiting Payment</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No freeze requests found
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Freeze Request</DialogTitle>
            <DialogDescription>
              Confirm the freeze start date for {selectedRequest?.members.first_name}{" "}
              {selectedRequest?.members.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Freeze Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !approveStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {approveStartDate ? format(approveStartDate, "MMMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={approveStartDate}
                    onSelect={setApproveStartDate}
                    disabled={(date) => isBefore(date, startOfToday())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">
                <strong>Duration:</strong> {selectedRequest?.duration_months} month(s)
              </p>
              <p className="text-sm">
                <strong>Fee:</strong> ${selectedRequest?.freeze_fee_total}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={!approveStartDate || approveRequest.isPending}
            >
              {approveRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Freeze Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason for Rejection</Label>
              <Textarea
                id="reject-reason"
                placeholder="Enter the reason for rejecting this request..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectReason.trim() || rejectRequest.isPending}
            >
              {rejectRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
