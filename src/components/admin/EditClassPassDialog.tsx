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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";

interface ClassPass {
  id: string;
  status: string;
  expires_at: string;
  purchased_at: string;
  classes_remaining: number;
  classes_total: number;
  pass_type: string;
  category: string;
}

interface EditClassPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pass: ClassPass;
  queryKeysToInvalidate: string[][];
}

export function EditClassPassDialog({ open, onOpenChange, pass, queryKeysToInvalidate }: EditClassPassDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(pass.status);
  const [expiresAt, setExpiresAt] = useState<Date>(new Date(pass.expires_at));
  const [purchasedAt, setPurchasedAt] = useState<Date>(new Date(pass.purchased_at));
  const [classesRemaining, setClassesRemaining] = useState(pass.classes_remaining);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidateAll = () => {
    queryKeysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("class_passes")
        .update({
          status: status as any,
          expires_at: expiresAt.toISOString(),
          purchased_at: purchasedAt.toISOString(),
          classes_remaining: Math.max(0, Math.min(classesRemaining, pass.classes_total)),
        })
        .eq("id", pass.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class pass updated");
      invalidateAll();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(`Failed to update: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_passes").delete().eq("id", pass.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class pass deleted");
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
          <DialogTitle>Edit Class Pass</DialogTitle>
          <DialogDescription>
            {pass.pass_type} — {pass.category?.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="exhausted">Exhausted</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Classes Remaining */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Classes Remaining (max {pass.classes_total})
            </Label>
            <Input
              type="number"
              min={0}
              max={pass.classes_total}
              value={classesRemaining}
              onChange={(e) => setClassesRemaining(parseInt(e.target.value) || 0)}
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

          {/* Purchased Date */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Purchased Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(purchasedAt, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={purchasedAt}
                  onSelect={(d) => d && setPurchasedAt(d)}
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
                <Trash2 className="h-4 w-4 mr-1" /> Delete Pass
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
