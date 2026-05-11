import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

export const CANCELLATION_POLICY_TEXT =
  "Free cancellation up to 24 hours before class. Late cancellations forfeit your credit or pass.";

export function CancellationPolicyInline({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      <span className="font-medium text-foreground">Cancellation policy:</span> {CANCELLATION_POLICY_TEXT}
    </p>
  );
}

export function CancellationPolicyLink() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          <Info className="h-3.5 w-3.5" />
          Cancellation policy
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">
        <p className="font-medium mb-1">Cancellation policy</p>
        <p className="text-muted-foreground">{CANCELLATION_POLICY_TEXT}</p>
      </PopoverContent>
    </Popover>
  );
}
