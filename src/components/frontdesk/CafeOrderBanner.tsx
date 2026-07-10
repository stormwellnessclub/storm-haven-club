import { Link } from "react-router-dom";
import { UtensilsCrossed, ArrowRight } from "lucide-react";
import { useAdminCafeNotifications } from "@/hooks/useAdminCafeNotifications";

/**
 * Persistent red banner at the top of the front-desk shell that surfaces
 * pending / preparing cafe orders. Complements the audio chime — some kitchens
 * won't hear it, so front desk needs a visible cue.
 *
 * Clicking navigates to /frontdesk/cafe (the cafe POS queue view).
 */
export function CafeOrderBanner() {
  const { data } = useAdminCafeNotifications();
  const active = data?.totalActiveCount ?? 0;
  if (active <= 0) return null;

  const pending = data?.pendingCount ?? 0;
  const preparing = data?.preparingCount ?? 0;

  return (
    <Link
      to="/frontdesk/cafe"
      className="block bg-red-600 text-white hover:bg-red-700 transition-colors border-b border-red-800"
      aria-label={`${active} unfulfilled cafe orders — open cafe queue`}
    >
      <div className="px-4 py-2 flex items-center gap-3 text-sm font-medium">
        <UtensilsCrossed className="h-4 w-4 shrink-0 animate-pulse" />
        <span>
          <strong>{active}</strong> unfulfilled cafe {active === 1 ? "order" : "orders"}
          {pending > 0 && preparing > 0 && (
            <span className="ml-2 opacity-90">
              ({pending} new · {preparing} preparing)
            </span>
          )}
          {pending > 0 && preparing === 0 && (
            <span className="ml-2 opacity-90">({pending} new)</span>
          )}
          {preparing > 0 && pending === 0 && (
            <span className="ml-2 opacity-90">({preparing} preparing)</span>
          )}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs opacity-90">
          View queue <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
