import { useState } from "react";
import { PTModal, PTAlert, ptButtonClass } from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCents } from "@/lib/ptFormat";
import { usePTRefundMutations } from "@/hooks/pt/usePTBillingCenter";

export interface PTRefundTarget {
  paymentId: string;
  userId: string;
  memberId?: string | null;
  clientName: string;
  amountCents: number;
  refundedCents: number;
  stripePaymentIntentId?: string | null;
}

/**
 * Money-only refund. Session entitlement is never changed here — removing
 * sessions is a separate package adjustment so the two ledgers stay honest.
 */
export function PTRefundDialog({ target, onClose }: { target: PTRefundTarget | null; onClose: () => void }) {
  const { refundPayment } = usePTRefundMutations();
  const net = target ? target.amountCents - target.refundedCents : 0;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  if (!target) return null;
  const cents = Math.round(parseFloat(amount || "0") * 100) || net;
  const valid = cents > 0 && cents <= net && reason.trim().length > 2 && ack;

  return (
    <PTModal
      open={!!target}
      onOpenChange={(v) => !v && onClose()}
      title="Refund PT payment"
      description={target.clientName}
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("danger")}
            disabled={!valid || refundPayment.isPending}
            onClick={async () => {
              await refundPayment.mutateAsync({
                paymentId: target.paymentId,
                amountCents: cents,
                reason,
                stripePaymentIntentId: target.stripePaymentIntentId ?? null,
                memberId: target.memberId ?? null,
              });
              onClose(); setAmount(""); setReason(""); setAck(false);
            }}
          >
            {refundPayment.isPending ? "Processing…" : `Refund ${formatCents(cents)}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <PTAlert tone={target.stripePaymentIntentId ? "warning" : "info"}>
          {target.stripePaymentIntentId
            ? "This refund will be sent to Stripe against the original charge, then recorded here."
            : "No Stripe charge is linked, so this is recorded as a manual/offline refund."}
        </PTAlert>

        <div className="rounded-lg border border-pt-line bg-white px-4 py-3 text-[13px] space-y-1">
          <div className="flex justify-between"><span className="text-pt-muted">Original payment</span><span>{formatCents(target.amountCents)}</span></div>
          <div className="flex justify-between"><span className="text-pt-muted">Already refunded</span><span>{formatCents(target.refundedCents)}</span></div>
          <div className="flex justify-between font-medium"><span className="text-pt-muted">Refundable</span><span>{formatCents(net)}</span></div>
        </div>

        <div>
          <Label className="text-[11px] text-pt-muted">Refund amount $ (blank = full refundable)</Label>
          <Input
            type="number" min={0} step="0.01" value={amount}
            placeholder={(net / 100).toFixed(2)}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 border-pt-line bg-white"
          />
          {cents > net && <p className="text-[11px] text-pt-red mt-1">Cannot exceed net collected.</p>}
        </div>

        <div>
          <Label className="text-[11px] text-pt-muted">Reason (required, appears on the audit record)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="border-pt-line bg-white" />
        </div>

        <label className="flex items-start gap-2 text-[13px]">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} className="mt-0.5" />
          <span>
            I understand this refunds money only. To remove session credits, use a package adjustment.
          </span>
        </label>
      </div>
    </PTModal>
  );
}
