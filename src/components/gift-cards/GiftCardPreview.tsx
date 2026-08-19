import { Gift, Calendar } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

const TZ = "America/Detroit";

interface Props {
  amountCents: number;
  serviceLabel?: string | null;
  hideAmount?: boolean;
  recipientName: string;
  senderName: string;
  customMessage?: string;
  code?: string;
  scheduledSendAt?: string | null;
  expiresAt?: string | null;
  className?: string;
}

export function GiftCardPreview({
  amountCents,
  serviceLabel,
  hideAmount,
  recipientName,
  senderName,
  customMessage,
  code,
  scheduledSendAt,
  expiresAt,
  className,
}: Props) {
  const amount = (amountCents / 100).toFixed(2);
  const scheduled = scheduledSendAt && new Date(scheduledSendAt).getTime() > Date.now();

  return (
    <div className={cn("space-y-3", className)}>
      {scheduled && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          <Calendar className="h-3.5 w-3.5" />
          Scheduled to send{" "}
          <strong>{formatInTimeZone(new Date(scheduledSendAt!), TZ, "PPP 'at' p")}</strong>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border shadow-sm">
        {/* Header / card face */}
        <div className="relative bg-gradient-to-br from-primary/90 to-primary p-6 text-primary-foreground">
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] opacity-80">Storm Wellness Club</div>
              <div className="mt-1 text-sm opacity-90">Gift Card</div>
            </div>
            <Gift className="h-7 w-7 opacity-90" />
          </div>
          {hideAmount ? (
            <div className="relative mt-6 text-2xl font-semibold leading-snug">
              {serviceLabel?.trim() || "A Storm Wellness Club Experience"}
            </div>
          ) : (
            <>
              <div className="relative mt-6 text-4xl font-bold">${amount}</div>
              {serviceLabel?.trim() && (
                <div className="relative mt-1 text-sm opacity-90">{serviceLabel.trim()}</div>
              )}
            </>
          )}
        </div>

        {/* Body */}
        <div className="space-y-4 bg-card p-5 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">To</div>
            <div className="font-medium text-foreground">{recipientName || "Recipient"}</div>
          </div>

          {customMessage?.trim() && (
            <div className="rounded-md border bg-muted/40 p-3 italic text-foreground">
              &ldquo;{customMessage.trim()}&rdquo;
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">From</div>
            <div className="font-medium text-foreground">{senderName || "A friend"}</div>
          </div>

          <div className="rounded-md border border-dashed p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gift code</div>
            <div className="mt-1 font-mono text-base font-semibold tracking-[0.25em]">
              {code || "XXXX-XXXX-XXXX"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Redeemable at checkout or at the front desk
            </div>
          </div>

          {expiresAt && (
            <div className="text-xs text-muted-foreground">
              Valid through {formatInTimeZone(new Date(expiresAt), TZ, "PPP")}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        This is a preview of the email your recipient will receive.
      </p>
    </div>
  );
}
