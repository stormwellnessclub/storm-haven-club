import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, RotateCcw, XCircle, Coins, DollarSign } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useUndoAdminAction } from "@/hooks/useAdminRefunds";

interface ActionLog {
  id: string;
  action_type: string;
  action_data: Record<string, unknown>;
  created_at: string;
  performed_by: string | null;
  undo_expires_at: string | null;
}

interface UndoActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionLog | null;
  memberId: string;
  memberName?: string;
  performerName?: string;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_subscription: 'Created Subscription',
  sell_membership: 'Sold Membership',
  sell_class_package: 'Sold Class Package',
  status_change: 'Changed Status',
  cancel_subscription: 'Cancelled Subscription',
  refund: 'Processed Refund',
};

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'create_subscription':
    case 'sell_membership':
      return <DollarSign className="h-4 w-4" />;
    case 'sell_class_package':
      return <Coins className="h-4 w-4" />;
    case 'cancel_subscription':
      return <XCircle className="h-4 w-4" />;
    default:
      return <RotateCcw className="h-4 w-4" />;
  }
};

export function UndoActionDialog({
  open,
  onOpenChange,
  action,
  memberId,
  memberName,
  performerName,
}: UndoActionDialogProps) {
  const { isSuperAdmin } = useUserRoles();
  const undoAction = useUndoAdminAction();
  
  const [includeRefund, setIncludeRefund] = useState(false);
  const [managerCode, setManagerCode] = useState("");

  if (!action) return null;

  const needsManagerCode = !isSuperAdmin();
  const hasChargeToRefund = !!action.action_data?.payment_intent_id || !!action.action_data?.charge_amount;
  const chargeAmount = (action.action_data?.charge_amount as number) || 0;

  const getUndoConsequences = () => {
    const consequences: string[] = [];
    
    switch (action.action_type) {
      case 'create_subscription':
      case 'sell_membership':
        consequences.push('Cancel the Stripe subscription');
        consequences.push('Revert member status to "pending_activation"');
        if (action.action_data?.credits_allocated) {
          const credits = action.action_data.credits_allocated as Record<string, number>;
          const creditStr = Object.entries(credits)
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${v} ${k.replace('_', ' ')}`)
            .join(', ');
          if (creditStr) {
            consequences.push(`Remove allocated credits: ${creditStr}`);
          }
        }
        break;
      case 'sell_class_package':
        consequences.push('Mark class pass as cancelled');
        consequences.push('Pass will no longer be usable');
        break;
      case 'status_change':
        const oldStatus = action.action_data?.old_status as string;
        if (oldStatus) {
          consequences.push(`Revert status to "${oldStatus}"`);
        }
        break;
    }

    return consequences;
  };

  const handleUndo = async () => {
    await undoAction.mutateAsync({
      actionLogId: action.id,
      includeRefund: hasChargeToRefund && includeRefund,
      managerCode: managerCode.trim() || undefined,
    });

    onOpenChange(false);
  };

  const timeAgo = formatDistanceToNow(new Date(action.created_at), { addSuffix: true });
  const expiresIn = action.undo_expires_at 
    ? formatDistanceToNow(new Date(action.undo_expires_at), { addSuffix: false })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Undo Action
          </DialogTitle>
          <DialogDescription>
            Reverse the last action for {memberName || 'this member'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action Info */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getActionIcon(action.action_type)}
                <span className="font-medium">
                  {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                </span>
              </div>
              <Badge variant="outline">{timeAgo}</Badge>
            </div>
            {performerName && (
              <p className="text-sm text-muted-foreground">
                Performed by: {performerName}
              </p>
            )}
            {expiresIn && (
              <p className="text-xs text-warning">
                Undo available for: {expiresIn}
              </p>
            )}
          </div>

          {/* Consequences */}
          <div className="space-y-2">
            <Label>This will:</Label>
            <ul className="space-y-2">
              {getUndoConsequences().map((consequence, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <span>{consequence}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Refund Option */}
          {hasChargeToRefund && (
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <Checkbox
                id="include-refund"
                checked={includeRefund}
                onCheckedChange={(checked) => setIncludeRefund(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="include-refund" className="cursor-pointer">
                  Also process refund
                  {chargeAmount > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      (${(chargeAmount / 100).toFixed(2)})
                    </span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Refund the initial charge back to the customer's card
                </p>
              </div>
            </div>
          )}

          {/* Manager Code */}
          {needsManagerCode && (
            <div className="space-y-2">
              <Label htmlFor="manager-code">Manager Code (Required)</Label>
              <Input
                id="manager-code"
                type="text"
                placeholder="Enter your manager code"
                value={managerCode}
                onChange={(e) => setManagerCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be reversed. Please confirm you want to proceed.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleUndo}
            disabled={undoAction.isPending || (needsManagerCode && !managerCode.trim())}
          >
            {undoAction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Undo Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
