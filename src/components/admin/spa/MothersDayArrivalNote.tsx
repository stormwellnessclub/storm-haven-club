import { Gift } from "lucide-react";
import { isMothersDayVoucher } from "@/lib/mothersDayArrival";

/** Staff-only arrival guidance for Mother's Day voucher guests. */
export function MothersDayArrivalNote({ appointment }: { appointment: { payment_method?: string | null } | null | undefined }) {
  if (!isMothersDayVoucher(appointment)) return null;
  return (
    <div className="rounded-lg border border-accent bg-accent/15 p-3 text-sm text-foreground">
      <p className="flex items-center gap-2 font-semibold uppercase tracking-wide text-xs">
        <Gift className="h-4 w-4" /> Mother's Day guest · includes wet spa access
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        <li>Give her a short wet spa tour: wet spa, locker room, Wi-Fi password.</li>
        <li>A full gym tour isn't needed unless she asks.</li>
        <li>Best after her massage. If she arrives early and wants the wet spa first, that's fine.</li>
      </ul>
    </div>
  );
}
