import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DollarSign, CheckCircle, Clock, XCircle, Mail, Loader2, RotateCcw, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ITEMS_PER_PAGE = 10;
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

type RefundMethod = "stripe" | "check" | "other";

interface ChargeHistoryProps {
  applicationId?: string;
  memberId?: string;
  showTitle?: boolean;
  maxItems?: number;
  // Admin props for resend functionality
  isAdmin?: boolean;
  recipientEmail?: string;
  recipientName?: string;
}

interface Charge {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
  refund_notes: string | null;
  refund_method: string | null;
  refunded_at: string | null;
  refunded_by: string | null;
}

export function ChargeHistory({ 
  applicationId, 
  memberId, 
  showTitle = true, 
  maxItems,
  isAdmin = false,
  recipientEmail,
  recipientName,
}: ChargeHistoryProps) {
  const queryClient = useQueryClient();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [refundingCharge, setRefundingCharge] = useState<Charge | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("stripe");
  const [refundNotes, setRefundNotes] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Reset refund form when dialog opens/closes
  useEffect(() => {
    if (refundingCharge) {
      setRefundAmount((refundingCharge.amount / 100).toFixed(2));
      setRefundMethod(refundingCharge.stripe_payment_intent_id ? "stripe" : "other");
      setRefundNotes("");
    } else {
      setRefundAmount("");
      setRefundMethod("stripe");
      setRefundNotes("");
    }
  }, [refundingCharge]);

  const { data: charges, isLoading } = useQuery({
    queryKey: ["charge-history", applicationId, memberId],
    queryFn: async () => {
      let query = supabase
        .from("manual_charges")
        .select("id, amount, description, status, created_at, stripe_payment_intent_id, refund_notes, refund_method, refunded_at, refunded_by")
        .order("created_at", { ascending: false });
      
      if (applicationId) {
        query = query.eq("application_id", applicationId);
      } else if (memberId) {
        query = query.eq("member_id", memberId);
      } else {
        return [];
      }
      
      if (maxItems) {
        query = query.limit(maxItems);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Charge[];
    },
    enabled: !!(applicationId || memberId),
  });

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [applicationId, memberId]);

  // Calculate pagination
  const totalItems = charges?.length ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCharges = charges?.slice(startIndex, endIndex) ?? [];

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleResendReceipt = async (charge: Charge) => {
    if (!recipientEmail || !recipientName) {
      toast.error("Recipient information not available");
      return;
    }

    setResendingId(charge.id);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "charge_confirmation",
          to: recipientEmail,
          data: {
            name: recipientName,
            description: charge.description,
            amount: (charge.amount / 100).toFixed(2),
            date: format(parseISO(charge.created_at), "MMMM d, yyyy"),
            cardBrand: "Card",
            cardLast4: "****",
          },
        },
      });

      if (error) throw error;
      toast.success(`Receipt resent to ${recipientEmail}`);
    } catch (err: any) {
      console.error("Failed to resend receipt:", err);
      toast.error(err.message || "Failed to resend receipt");
    } finally {
      setResendingId(null);
    }
  };

  const handleRefund = async () => {
    if (!refundingCharge) {
      toast.error("No charge selected for refund");
      return;
    }

    const amountInCents = Math.round(parseFloat(refundAmount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    if (amountInCents > refundingCharge.amount) {
      toast.error("Refund amount cannot exceed original charge");
      return;
    }

    const isPartialRefund = amountInCents < refundingCharge.amount;

    setIsRefunding(true);
    try {
      if (refundMethod === "stripe") {
        // Process refund through Stripe
        if (!refundingCharge.stripe_payment_intent_id) {
          toast.error("Cannot process Stripe refund: missing payment information");
          return;
        }

        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "refund_charge",
            chargeId: refundingCharge.id,
            paymentIntentId: refundingCharge.stripe_payment_intent_id,
            refundAmount: isPartialRefund ? amountInCents : undefined,
            refundNotes: refundNotes.trim() || undefined,
            refundMethodType: refundMethod,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Refund failed");

        toast.success(`Refunded $${refundAmount} via Stripe successfully`);
      } else {
        // Manual refund (check/other) - just update the database
        const newStatus = isPartialRefund ? "partially_refunded" : "refunded";
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("manual_charges")
          .update({ 
            status: newStatus,
            refund_method: refundMethod,
            refund_notes: refundNotes.trim() || null,
            refunded_at: new Date().toISOString(),
            refunded_by: user?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", refundingCharge.id);

        if (error) throw error;

        const methodLabel = refundMethod === "check" ? "check" : "other method";
        toast.success(`Marked as refunded via ${methodLabel} ($${refundAmount})`);
      }

      queryClient.invalidateQueries({ queryKey: ["charge-history", applicationId, memberId] });
    } catch (err: any) {
      console.error("Failed to process refund:", err);
      toast.error(err.message || "Failed to process refund");
    } finally {
      setIsRefunding(false);
      setRefundingCharge(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {showTitle && <Skeleton className="h-5 w-32" />}
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!charges || charges.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No charges recorded
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "refunded":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
            <RotateCcw className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      case "partially_refunded":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
            <RotateCcw className="h-3 w-3 mr-1" />
            Partial Refund
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportToCSV = () => {
    if (!charges || charges.length === 0) return;

    const headers = [
      "Date",
      "Description",
      "Amount",
      "Status",
      "Refund Method",
      "Refund Date",
      "Refund Notes",
    ];

    const rows = charges.map((charge) => [
      format(parseISO(charge.created_at), "yyyy-MM-dd HH:mm:ss"),
      `"${charge.description.replace(/"/g, '""')}"`, // Escape quotes in description
      (charge.amount / 100).toFixed(2),
      charge.status,
      charge.refund_method || "",
      charge.refunded_at ? format(parseISO(charge.refunded_at), "yyyy-MM-dd HH:mm:ss") : "",
      charge.refund_notes ? `"${charge.refund_notes.replace(/"/g, '""')}"` : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `charge-history-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Charge history exported to CSV");
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Charge History</p>
          </div>
          {isAdmin && charges && charges.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={exportToCSV}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export to CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <div className="space-y-2">
        {paginatedCharges.map((charge) => (
          <div
            key={charge.id}
            className="p-3 rounded-lg bg-secondary/50 border space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{charge.description}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(charge.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-semibold">
                  ${(charge.amount / 100).toFixed(2)}
                </span>
                {getStatusBadge(charge.status)}
                {isAdmin && charge.status === "succeeded" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setRefundingCharge(charge)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Refund ${(charge.amount / 100).toFixed(2)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {isAdmin && charge.status === "succeeded" && recipientEmail && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => handleResendReceipt(charge)}
                          disabled={resendingId === charge.id}
                        >
                          {resendingId === charge.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Send receipt to {recipientEmail}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            
            {/* Refund Details - shown for refunded/partially refunded charges */}
            {(charge.status === "refunded" || charge.status === "partially_refunded") && (
              <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RotateCcw className="h-3 w-3" />
                  <span>
                    Refunded {charge.refunded_at ? format(parseISO(charge.refunded_at), "MMM d, yyyy") : ""}
                    {charge.refund_method && (
                      <span className="ml-1">
                        via {charge.refund_method === "stripe" ? "Stripe" : charge.refund_method === "check" ? "Check" : "Other"}
                      </span>
                    )}
                  </span>
                </div>
                {charge.refund_notes && (
                  <p className="text-muted-foreground italic pl-5">
                    "{charge.refund_notes}"
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Refund Dialog */}
      <Dialog open={!!refundingCharge} onOpenChange={(open) => !open && setRefundingCharge(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund for "{refundingCharge?.description}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Refund Amount */}
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundingCharge ? (refundingCharge.amount / 100) : 0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Original charge: ${refundingCharge ? (refundingCharge.amount / 100).toFixed(2) : '0.00'}
              </p>
            </div>

            {/* Refund Method */}
            <div className="space-y-2">
              <Label>Refund Method</Label>
              <RadioGroup value={refundMethod} onValueChange={(v) => setRefundMethod(v as RefundMethod)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value="stripe" 
                    id="method-stripe" 
                    disabled={!refundingCharge?.stripe_payment_intent_id}
                  />
                  <Label htmlFor="method-stripe" className="font-normal cursor-pointer">
                    Stripe (refund to original card)
                    {!refundingCharge?.stripe_payment_intent_id && (
                      <span className="text-xs text-muted-foreground ml-1">(unavailable)</span>
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="check" id="method-check" />
                  <Label htmlFor="method-check" className="font-normal cursor-pointer">
                    Check (manual refund)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="method-other" />
                  <Label htmlFor="method-other" className="font-normal cursor-pointer">
                    Other (cash, credit, etc.)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {refundMethod !== "stripe" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 p-2 rounded">
                Note: This will only mark the charge as refunded. You must process the actual refund manually.
              </p>
            )}

            {/* Refund Notes */}
            <div className="space-y-2">
              <Label htmlFor="refund-notes">Refund Notes (optional)</Label>
              <Textarea
                id="refund-notes"
                placeholder="Reason for refund, reference number, etc."
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                rows={2}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {refundNotes.length}/500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundingCharge(null)} disabled={isRefunding}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={isRefunding || !refundAmount || parseFloat(refundAmount) <= 0}
            >
              {isRefunding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Refund $${refundAmount || '0.00'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}