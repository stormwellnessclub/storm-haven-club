import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export type AppliedGiftCard = {
  code: string;
  balanceCents: number;
  appliedCents: number;
};

interface Props {
  /** Total of the order in cents — used to cap how much of the card is applied. */
  totalCents: number;
  applied: AppliedGiftCard | null;
  onApply: (card: AppliedGiftCard) => void;
  onRemove: () => void;
  className?: string;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function RedeemGiftCardField({ totalCents, applied, onApply, onRemove, className }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);

  const validate = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc("validate_gift_card_code", { p_code: trimmed });
      if (error) throw error;
      const res = data as any;
      if (!res?.valid) throw new Error(res?.error || "That gift card code isn't valid");
      const balance = Number(res.balance_cents || 0);
      if (balance <= 0) throw new Error("This gift card has no remaining balance");
      onApply({
        code: trimmed,
        balanceCents: balance,
        appliedCents: Math.min(balance, totalCents),
      });
      toast.success(`Gift card applied — ${money(Math.min(balance, totalCents))} off`);
      setCode("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Could not apply gift card");
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Gift className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-mono text-xs">{applied.code}</span>
            <Badge variant="secondary" className="shrink-0">−{money(applied.appliedCents)}</Badge>
          </div>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {applied.balanceCents > applied.appliedCents && (
          <p className="mt-1 text-xs text-muted-foreground">
            {money(applied.balanceCents - applied.appliedCents)} will remain on the card.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {!open ? (
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => setOpen(true)}
        >
          Have a gift card?
        </button>
      ) : (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Gift card code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && validate()}
            className="font-mono uppercase"
          />
          <Button onClick={validate} disabled={checking || !code.trim()}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        </div>
      )}
    </div>
  );
}
