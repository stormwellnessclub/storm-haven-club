import React, { useState } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Info, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmationConfig {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

export interface AdminActionButtonProps {
  label: string;
  onClick: () => void | Promise<void>;
  tooltip: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  icon?: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  confirmationConfig?: ConfirmationConfig;
  className?: string;
  showInfoIcon?: boolean;
}

export function AdminActionButton({
  label,
  onClick,
  tooltip,
  size = "sm",
  variant = "default",
  icon,
  disabled,
  isLoading,
  confirmationConfig,
  className,
  showInfoIcon = true,
}: AdminActionButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClick = () => {
    if (confirmationConfig) {
      setShowConfirm(true);
    } else {
      onClick();
    }
  };

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onClick();
    } finally {
      setIsExecuting(false);
      setShowConfirm(false);
    }
  };

  const loading = isLoading || isExecuting;

  return (
    <TooltipProvider>
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Button
          onClick={handleClick}
          variant={variant}
          size={size}
          disabled={disabled || loading}
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          {!loading && icon}
          {label}
        </Button>
        
        {showInfoIcon && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm hover:bg-muted"
                tabIndex={-1}
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {confirmationConfig && (
          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {confirmationConfig.title}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-muted-foreground">
                    {confirmationConfig.description}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isExecuting}>
                  {confirmationConfig.cancelLabel || "Cancel"}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleConfirm();
                  }}
                  disabled={isExecuting}
                  className={cn(
                    confirmationConfig.variant === "destructive" &&
                      "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  )}
                >
                  {isExecuting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {confirmationConfig.confirmLabel || "Confirm"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Pre-configured tooltip texts for common admin actions
 */
export const ADMIN_ACTION_TOOLTIPS = {
  createSubscription:
    "Creates a recurring Stripe subscription for membership dues. The member's card will be charged automatically on the billing date. Cannot be undone from this portal.",
  chargeCard:
    "Charge a one-time amount to the member's saved card. Enter amount and description before confirming.",
  suspend:
    "Temporarily suspends membership. Member loses access to all benefits until reactivated.",
  delete:
    "Permanently deletes this member record. This action cannot be undone.",
  reactivate:
    "Restores membership to active status. Member regains access to benefits.",
  activate:
    "Bypasses payment requirements and activates member immediately. Super Admin only.",
  cancelAnnualFee:
    "Cancels the recurring annual fee subscription in Stripe. Does not issue a refund.",
  changeTier:
    "Opens tier change dialog. May adjust pricing and credits based on the new tier.",
  addCard:
    "Opens a secure form to save a new payment card for this member.",
  updateCard:
    "Opens a secure form to update or replace the member's saved payment card.",
  sendActivationEmail:
    "Sends an email to the member with instructions to complete their account setup.",
} as const;
