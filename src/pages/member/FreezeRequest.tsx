import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CalendarIcon, Snowflake, AlertCircle, CheckCircle2, Clock, X, DollarSign, ExternalLink } from "lucide-react";
import { format, addMonths, isBefore, startOfTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { useMemberFreezes, useFreezeEligibility, useCreateFreezeRequest, useCancelFreezeRequest } from "@/hooks/useMemberFreezes";
import { useUserMembership } from "@/hooks/useUserMembership";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

const statusColors: Record<string, string> = {
  pending: "bg-accent/10 text-accent border-accent/20",
  approved: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  active: "bg-accent/10 text-accent border-accent/20",
  completed: "bg-muted/20 text-muted-foreground border-muted/20",
  rejected: "bg-destructive/10 text-destructive-foreground border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function FreezeRequest() {
  const [startDate, setStartDate] = useState<Date>();
  const [duration, setDuration] = useState<"1" | "2">("1");
  const [reason, setReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelFreezeId, setCancelFreezeId] = useState<string | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { data: freezes, isLoading: freezesLoading } = useMemberFreezes();
  const { data: eligibility, isLoading: eligibilityLoading } = useFreezeEligibility();
  const createFreeze = useCreateFreezeRequest();
  const cancelFreeze = useCancelFreezeRequest();

  const isLoading = membershipLoading || freezesLoading || eligibilityLoading;
  const durationMonths = parseInt(duration) as 1 | 2;
  const freezeFee = durationMonths * 20;
  const endDate = startDate ? addMonths(startDate, durationMonths) : null;

  const canSubmit = 
    eligibility?.canFreeze && 
    startDate && 
    durationMonths <= (eligibility?.monthsRemaining || 0) &&
    membership?.id;

  const handleSubmit = () => {
    if (!membership?.id || !startDate) return;
    
    createFreeze.mutate({
      memberId: membership.id,
      startDate,
      durationMonths,
      reason: reason || undefined,
    });

    // Reset form
    setStartDate(undefined);
    setDuration("1");
    setReason("");
  };

  const handleCancelRequest = (freezeId: string) => {
    setCancelFreezeId(freezeId);
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    if (cancelFreezeId) {
      cancelFreeze.mutate(cancelFreezeId);
    }
    setShowCancelDialog(false);
    setCancelFreezeId(null);
  };

  const handlePayFreezeFee = async (freezeId: string, feeAmount: number) => {
    setIsPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment', {
        body: {
          action: 'create_freeze_fee_checkout',
          freezeId,
          freezeFeeAmount: feeAmount,
          successUrl: `${window.location.origin}/member/freeze?payment=success`,
          cancelUrl: `${window.location.origin}/member/freeze?payment=cancelled`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating freeze fee checkout:', error);
      toast.error('Failed to start payment. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const pendingRequest = freezes?.find(f => f.status === 'pending');
  const approvedRequest = freezes?.find(f => f.status === 'approved');
  const activeFreeze = freezes?.find(f => f.status === 'active');

  return (
    <MemberLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Membership Freeze</h1>
          <p className="text-muted-foreground">
            Request a temporary freeze on your membership
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Request Form or Status */}
            <div className="space-y-6">
              {/* Active Freeze Alert */}
              {activeFreeze && (
                <Alert className="border-purple-500/20 bg-purple-500/10">
                  <Snowflake className="h-4 w-4 text-purple-600" />
                  <AlertTitle className="text-purple-600">Membership Currently Frozen</AlertTitle>
                  <AlertDescription>
                    Your membership is frozen until{" "}
                    <strong>{format(new Date(activeFreeze.actual_end_date!), "MMMM d, yyyy")}</strong>.
                    It will automatically reactivate after this date.
                  </AlertDescription>
                </Alert>
              )}

              {/* Pending Request Alert */}
              {pendingRequest && (
                <Alert className="border-yellow-500/20 bg-yellow-500/10">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-600">Request Under Review</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Your freeze request for {pendingRequest.duration_months} month(s) starting{" "}
                      {format(new Date(pendingRequest.requested_start_date), "MMMM d, yyyy")} is being reviewed.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRequest(pendingRequest.id)}
                      className="mt-2"
                    >
                      Cancel Request
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Approved Request Alert */}
              {approvedRequest && (
                <Alert className="border-blue-500/20 bg-blue-500/10">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-600">Request Approved - Payment Required</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      Your freeze request has been approved! Please complete the payment of{" "}
                      <strong>${approvedRequest.freeze_fee_total}</strong> to activate the freeze.
                    </p>
                    <p className="text-sm">
                      Freeze will start on{" "}
                      {format(new Date(approvedRequest.actual_start_date!), "MMMM d, yyyy")}
                    </p>
                    <Button
                      onClick={() => handlePayFreezeFee(approvedRequest.id, approvedRequest.freeze_fee_total)}
                      disabled={isPaymentLoading}
                      className="mt-2"
                    >
                      {isPaymentLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      Pay ${approvedRequest.freeze_fee_total} Now
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Eligibility Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Snowflake className="h-5 w-5" />
                    Freeze Eligibility
                  </CardTitle>
                  <CardDescription>
                    You can freeze your membership up to 2 months per calendar year
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{eligibility?.monthsUsed || 0}</p>
                      <p className="text-xs text-muted-foreground">Months Used</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{eligibility?.monthsRemaining || 2}</p>
                      <p className="text-xs text-muted-foreground">Months Remaining</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">$20</p>
                      <p className="text-xs text-muted-foreground">Per Month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Request Form */}
              {eligibility?.canFreeze && !activeFreeze && !pendingRequest && !approvedRequest && (
                <Card>
                  <CardHeader>
                    <CardTitle>Request a Freeze</CardTitle>
                    <CardDescription>
                      Submit a request to temporarily freeze your membership
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Start Date */}
                    <div className="space-y-2">
                      <Label>Freeze Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "MMMM d, yyyy") : "Select start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            disabled={(date) => isBefore(date, startOfTomorrow())}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <RadioGroup value={duration} onValueChange={(v) => setDuration(v as "1" | "2")}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1" id="1-month" />
                          <Label htmlFor="1-month" className="font-normal">
                            1 Month ($20 fee)
                          </Label>
                        </div>
                        {(eligibility?.monthsRemaining || 0) >= 2 && (
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="2" id="2-months" />
                            <Label htmlFor="2-months" className="font-normal">
                              2 Months ($40 fee)
                            </Label>
                          </div>
                        )}
                      </RadioGroup>
                    </div>

                    {/* End Date Preview */}
                    {startDate && endDate && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">
                          Your freeze will end on{" "}
                          <strong className="text-foreground">{format(endDate, "MMMM d, yyyy")}</strong>
                        </p>
                      </div>
                    )}

                    {/* Reason */}
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason (optional)</Label>
                      <Textarea
                        id="reason"
                        placeholder="Let us know why you need to freeze your membership..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Separator />

                    {/* Summary */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Freeze Fee:</span>
                      </div>
                      <span className="text-xl font-bold">${freezeFee}</span>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={!canSubmit || createFreeze.isPending}
                      className="w-full"
                    >
                      {createFreeze.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Freeze Request
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!eligibility?.canFreeze && !activeFreeze && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Cannot Request Freeze</AlertTitle>
                  <AlertDescription>
                    {eligibility?.hasPending
                      ? "You already have a pending or approved freeze request."
                      : eligibility?.monthsRemaining === 0
                      ? "You've used all available freeze months for this year."
                      : "You've reached the maximum number of freezes (2) for this year."}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Right Column - History */}
            <Card>
              <CardHeader>
                <CardTitle>Freeze History</CardTitle>
                <CardDescription>
                  Your past and current freeze requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {freezes && freezes.length > 0 ? (
                  <div className="space-y-4">
                    {freezes.map((freeze) => (
                      <div
                        key={freeze.id}
                        className="flex items-start justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[freeze.status]}>
                              {freeze.status.charAt(0).toUpperCase() + freeze.status.slice(1)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {freeze.duration_months} month{freeze.duration_months > 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="text-sm">
                            {format(new Date(freeze.requested_start_date), "MMM d, yyyy")} -{" "}
                            {format(new Date(freeze.requested_end_date), "MMM d, yyyy")}
                          </p>
                          {freeze.rejection_reason && (
                            <p className="text-sm text-destructive">
                              Reason: {freeze.rejection_reason}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Submitted {format(new Date(freeze.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${freeze.freeze_fee_total}</p>
                          {freeze.fee_paid && (
                            <p className="text-xs text-green-600">Paid</p>
                          )}
                          {freeze.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelRequest(freeze.id)}
                              className="mt-2 h-8 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No freeze requests yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Freeze Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this freeze request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Cancel Request</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MemberLayout>
  );
}
