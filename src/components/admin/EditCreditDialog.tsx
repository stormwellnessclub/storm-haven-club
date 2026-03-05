import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { CREDIT_TYPE_LABELS, CreditType } from "@/lib/memberCredits";

interface CreditRecord {
  id: string;
  credit_type: string;
  credits_remaining: number;
  credits_total: number;
  expires_at: string;
  cycle_start: string;
  cycle_end: string;
}

interface EditCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: CreditRecord;
  queryKeysToInvalidate: string[][];
}

export function EditCreditDialog({ open, onOpenChange, credit, queryKeysToInvalidate }: EditCreditDialogProps) {
  const queryClient = useQueryClient();
  const [creditsRemaining, setCreditsRemaining] = useState(credit.credits_remaining);
  const [expiresAt, setExpiresAt] = useState<Date>(new Date(credit.expires_at));
  const [cycleStart, setCycleStart] = useState<Date>(new Date(credit.cycle_start));
  const [cycleEnd, setCycleEnd] = useState<Date>(new Date(credit.cycle_end));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidateAll = () => {
    queryKeysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  };

  const typeLabel = CREDIT_TYPE_LABELS[credit.credit_type as CreditType] || credit.credit_type;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("member_credits")
        .update({
          credits_remaining: Math.max(0, Math.min(creditsRemaining, credit.credits_total)),
          expires_at: expiresAt.toISOString(),
          cycle_start: format(cycleStart, "yyyy-MM-dd"),
          cycle_end: format(cycleEnd, "yyyy-MM-dd"),
        })
        .eq("id", credit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credit updated");
      invalidateAll();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(`Failed to update: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("member_credits").delete().eq("id", credit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credit deleted");
      invalidateAll();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`),
  });

  const isBusy = updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Wellness Credit</DialogTitle>
          <DialogDescription>{typeLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Credits Remaining */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Credits Remaining (max {credit.credits_total})
            </Label>
            <Input
              type="number"
              min={0}
              max={credit.credits_total}
              value={creditsRemaining}
              onChange={(e) => setCreditsRemaining(parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Expiration Date */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Expiration Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(expiresAt, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={(d) => d && setExpiresAt(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Cycle Start */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cycle Start</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(cycleStart, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={cycleStart}
                  onSelect={(d) => d && setCycleStart(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Cycle End */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cycle End</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(cycleEnd, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={cycleEnd}
                  onSelect={(d) => d && setCycleEnd(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {!confirmDelete ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={isBusy}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Credit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={isBusy}>
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirm Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={isBusy}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <Button onClick={() => updateMutation.mutate()} disabled={isBusy}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
