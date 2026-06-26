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
import { Loader2, CalendarIcon, Check, X, PlayCircle, Snowflake, Search, ShieldCheck, StopCircle, ExternalLink, Mail } from "lucide-react";
import { format, isBefore, startOfToday } from "date-fns";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RejectionScenario = "membership_not_active" | "membership_in_arrears" | "custom";

const FREEZE_REJECTION_PRESETS: Record<
  RejectionScenario,
  { label: string; subject: string; body: (firstName: string) => string }
> = {
  membership_not_active: {
    label: "Membership Not Yet Active",
    subject: "Regarding Your Freeze Request",
    body: (firstName) =>
      `Hi ${firstName || "there"},

Thank you for reaching out. After reviewing your account, we are unable to approve your freeze request at this time.

A membership freeze is a benefit reserved for members whose dues are active and current. Our records show that while your initiation fee was processed, your monthly dues have not yet been collected, meaning your membership has not been formally activated.

Because there is no active billing to pause, a freeze is not applicable to your account in its current state.

If you would like to discuss the status of your membership directly, please reach out to us.

The Storm Wellness Club Team`,
  },
  membership_in_arrears: {
    label: "Membership in Arrears",
    subject: "Regarding Your Freeze Request",
    body: (firstName) =>
      `Hi ${firstName || "there"},

Thank you for reaching out. After reviewing your account, we are unable to approve your freeze request at this time.

A membership freeze is a courtesy extended to members in good standing. Our records show that your monthly dues have been declined for the past two billing cycles, leaving a significant balance outstanding on your account.

Per the terms of your one-year membership agreement, you have until May 9, 2026 to bring all outstanding dues current. If the balance is not settled in full by that date, your account will be referred to collections in accordance with the agreement you signed at enrollment.

Once your account is current and in good standing, we would be glad to revisit a freeze request.

If you'd like to settle your balance or discuss a path forward, please reach out to us directly.

The Storm Wellness Club Team`,
  },
  custom: {
    label: "Custom",
    subject: "",
    body: () => "",
  },
};

import { cn } from "@/lib/utils";
import {
  useAdminFreezeRequests,
  useApproveFreezeRequest,
  useRejectFreezeRequest,
  useActivateFreeze,
  useEndFreezeEarly,
  useResendFreezePaymentEmail,
  type FreezeRequestWithMember,
} from "@/hooks/useAdminFreezeRequests";
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

const statusColors: Record<string, string> = {
  pending: "bg-accent/10 text-accent border-accent/20",
  approved: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  active: "bg-accent/10 text-accent border-accent/20",
  completed: "bg-muted/20 text-muted-foreground border-muted/20",
  rejected: "bg-destructive/10 text-destructive-foreground border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function FreezeRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showWaiveDialog, setShowWaiveDialog] = useState(false);
  const [showEndFreezeDialog, setShowEndFreezeDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FreezeRequestWithMember | null>(null);
  const [approveStartDate, setApproveStartDate] = useState<Date>();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectScenario, setRejectScenario] = useState<RejectionScenario>("custom");
  const [rejectEmailSubject, setRejectEmailSubject] = useState("");
  const [rejectEmailBody, setRejectEmailBody] = useState("");
  const [rejectSendEmail, setRejectSendEmail] = useState(true);
  const { isAdmin, isSuperAdmin } = useUserRoles();

  const { data: requests, isLoading } = useAdminFreezeRequests(statusFilter);
  const approveRequest = useApproveFreezeRequest();
  const rejectRequest = useRejectFreezeRequest();
  const activateFreeze = useActivateFreeze();
  const endFreezeEarly = useEndFreezeEarly();

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

  const applyRejectionScenario = (
    scenario: RejectionScenario,
    request: FreezeRequestWithMember | null,
  ) => {
    setRejectScenario(scenario);
    const preset = FREEZE_REJECTION_PRESETS[scenario];
    const firstName = request?.members.first_name ?? "";
    setRejectEmailSubject(preset.subject);
    setRejectEmailBody(preset.body(firstName));
  };

  const handleReject = (request: FreezeRequestWithMember) => {
    setSelectedRequest(request);
    setRejectReason("");
    setRejectSendEmail(true);
    // Auto-pick the right template based on the member so the email body is
    // visible immediately when the dialog opens.
    const fullName = `${request.members.first_name ?? ""} ${request.members.last_name ?? ""}`
      .trim()
      .toLowerCase();
    let initialScenario: RejectionScenario = "custom";
    if (fullName.includes("brea")) {
      initialScenario = "membership_not_active";
    } else if (fullName.includes("mariam")) {
      initialScenario = "membership_in_arrears";
    }
    applyRejectionScenario(initialScenario, request);
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
    if (rejectSendEmail && !rejectEmailBody.trim()) return;

    rejectRequest.mutate(
      {
        freezeId: selectedRequest.id,
        reason: rejectReason,
        sendEmail: rejectSendEmail,
        emailSubject: rejectEmailSubject,
        emailBody: rejectEmailBody,
        recipientEmail: selectedRequest.members.email,
        recipientFirstName: selectedRequest.members.first_name,
      },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setSelectedRequest(null);
        },
      }
    );
  };

  const handleActivate = (request: FreezeRequestWithMember) => {
    activateFreeze.mutate({ freezeId: request.id });
  };

  const handleWaiveFee = (request: FreezeRequestWithMember) => {
    setSelectedRequest(request);
    setShowWaiveDialog(true);
  };

  const confirmWaiveFee = () => {
    if (!selectedRequest) return;
    activateFreeze.mutate(
      { freezeId: selectedRequest.id, waiveFee: true },
      {
        onSuccess: () => {
          setShowWaiveDialog(false);
          setSelectedRequest(null);
        },
      }
    );
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
            <div className="mb-4 rounded-md border border-accent/30 bg-accent/5 p-3 text-sm">
              <p className="font-medium">Branded rejection templates are ready.</p>
              <p className="text-muted-foreground">
                Click the red <strong>Reject</strong> button on a pending request to open the email
                editor. Choose <em>Membership Not Yet Active</em> (Brea) or{" "}
                <em>Membership in Arrears</em> (Mariam) — the email is pre-filled and editable
                before you send.
              </p>
            </div>
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
                                  <Badge variant="outline" className="text-muted-foreground border-muted/20 bg-muted/20">
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
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">Awaiting Payment</Badge>
                                    {(isAdmin || isSuperAdmin) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleWaiveFee(request)}
                                        disabled={activateFreeze.isPending}
                                      >
                                        <ShieldCheck className="h-4 w-4 mr-1" />
                                        Waive Fee & Activate
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {request.status === 'active' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowEndFreezeDialog(true);
                                    }}
                                    disabled={endFreezeEarly.isPending}
                                  >
                                    <StopCircle className="h-4 w-4 mr-1" />
                                    End Freeze Early
                                  </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject Freeze Request</DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>Decline {selectedRequest.members.first_name} {selectedRequest.members.last_name}'s freeze request. Choose a scenario to pre-fill a branded email — you can edit before sending.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Scenario</Label>
              <Select
                value={rejectScenario}
                onValueChange={(value) =>
                  applyRejectionScenario(value as RejectionScenario, selectedRequest)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membership_not_active">
                    Membership Not Yet Active
                  </SelectItem>
                  <SelectItem value="membership_in_arrears">
                    Membership in Arrears
                  </SelectItem>
                  <SelectItem value="custom">Custom (write your own)</SelectItem>
                </SelectContent>
              </Select>
              {rejectScenario === "membership_not_active" && (
                <p className="text-xs text-muted-foreground">
                  This email speaks <strong>only</strong> to the freeze decision. To rescind the
                  membership approval entirely, open the member's profile and use Cancel
                  Membership separately — that flow sends its own email.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reject-reason">Internal Reason (audit only — not emailed)</Label>
              <Input
                id="reject-reason"
                placeholder="e.g. Member's dues are past due — not eligible for freeze"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                id="reject-send-email"
                checked={rejectSendEmail}
                onCheckedChange={(checked) => setRejectSendEmail(checked === true)}
              />
              <Label htmlFor="reject-send-email" className="cursor-pointer text-sm font-normal">
                Send rejection email to member
                {selectedRequest && (
                  <span className="text-muted-foreground"> ({selectedRequest.members.email})</span>
                )}
              </Label>
            </div>

            {rejectSendEmail && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reject-email-subject">Email Subject</Label>
                  <Input
                    id="reject-email-subject"
                    value={rejectEmailSubject}
                    onChange={(e) => setRejectEmailSubject(e.target.value)}
                    placeholder="Regarding Your Freeze Request"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reject-email-body">Email Message</Label>
                  <Textarea
                    id="reject-email-body"
                    value={rejectEmailBody}
                    onChange={(e) => setRejectEmailBody(e.target.value)}
                    rows={14}
                    className="font-serif text-sm leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    The message will be wrapped in the standard branded email layout when sent.
                    Edit freely before sending.
                  </p>
                </div>
              </>
            )}

            {selectedRequest && rejectScenario === "membership_not_active" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 p-3 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200 mb-1">
                  Need to also rescind {selectedRequest.members.first_name}'s membership?
                </p>
                <Link
                  to={`/admin/members/${selectedRequest.members.id}`}
                  className="inline-flex items-center gap-1 text-amber-900 dark:text-amber-200 underline underline-offset-2"
                >
                  Open member profile <ExternalLink className="h-3 w-3" />
                </Link>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  Use the Cancel Membership action there — it auto-sends a separate
                  cancellation email.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={
                !rejectReason.trim() ||
                (rejectSendEmail && !rejectEmailBody.trim()) ||
                rejectRequest.isPending
              }
            >
              {rejectRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rejectSendEmail ? "Reject & Send Email" : "Reject (no email)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Fee Dialog */}
      <Dialog open={showWaiveDialog} onOpenChange={setShowWaiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Freeze Fee</DialogTitle>
            <DialogDescription>
              Waive the ${selectedRequest?.freeze_fee_total} freeze fee for{" "}
              {selectedRequest?.members.first_name} {selectedRequest?.members.last_name}?
              This will activate the freeze immediately without payment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWaiveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmWaiveFee}
              disabled={activateFreeze.isPending}
            >
              {activateFreeze.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Waive Fee & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Freeze Early Dialog */}
      <AlertDialog open={showEndFreezeDialog} onOpenChange={setShowEndFreezeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Freeze Early</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately end the freeze for{" "}
              {selectedRequest?.members.first_name} {selectedRequest?.members.last_name},
              set their membership status to active, and resume billing on their Stripe subscriptions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedRequest) {
                  endFreezeEarly.mutate(selectedRequest.id, {
                    onSuccess: () => {
                      setShowEndFreezeDialog(false);
                      setSelectedRequest(null);
                    },
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {endFreezeEarly.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              End Freeze & Resume Billing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
