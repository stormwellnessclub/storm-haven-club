import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Gift } from "lucide-react";
import { useApplyMothersDayVoucher, type AppliedVoucher } from "@/hooks/useApplyMothersDayVoucher";

interface RedeemVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (code: string, voucher: AppliedVoucher) => void;
}

/**
 * Generic spa voucher redemption entry.
 * Today supports Mother's Day (`MOM-`). Future: gift cards (`GIFT-`).
 */
export function RedeemVoucherDialog({ open, onOpenChange, onResolved }: RedeemVoucherDialogProps) {
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { apply, applying } = useApplyMothersDayVoucher();

  const reset = () => {
    setCode("");
    setLocalError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLocalError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setLocalError("Enter a voucher code");
      return;
    }

    // Route by prefix. Today only MOM- is supported.
    if (trimmed.startsWith("MOM-")) {
      const result = await apply(trimmed);
      if (!result.ok || !result.voucher) {
        setLocalError(result.error || "Code not found, expired, already used, or not yet paid.");
        return;
      }
      onResolved(trimmed, result.voucher);
      reset();
      onOpenChange(false);
      return;
    }

    setLocalError("Code not recognized. Please check and try again.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-gold" />
            Redeem a voucher
          </DialogTitle>
          <DialogDescription>
            Enter your voucher or gift card code. We'll auto-apply it to your booking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            autoFocus
            placeholder="e.g. MOM-XXXXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (localError) setLocalError(null);
            }}
            className="uppercase tracking-wider"
            disabled={applying}
          />

          {localError && (
            <p className="text-sm text-destructive">{localError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={applying || !code.trim()}>
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Looking up…
                </>
              ) : (
                "Look up code"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
