import { Link } from "react-router-dom";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";

/**
 * Persistent blue banner at the top of the front-desk shell that surfaces
 * open support tickets / unread member messages. Sits alongside the red
 * CafeOrderBanner so front desk staff see both channels at a glance.
 */
export function SupportAlertBanner() {
  const { data } = useAdminSupportNotifications();
  const openCount = data?.openCount ?? 0;
  const unreadCount = data?.unreadCount ?? 0;
  if (openCount <= 0 && unreadCount <= 0) return null;

  return (
    <Link
      to="/frontdesk/messages"
      className="block bg-blue-600 text-white hover:bg-blue-700 transition-colors border-b border-blue-800"
      aria-label={`${openCount} open support tickets, ${unreadCount} unread messages`}
    >
      <div className="px-4 py-2 flex items-center gap-3 text-sm font-medium">
        <MessageCircle className="h-4 w-4 shrink-0 animate-pulse" />
        <span>
          {openCount > 0 && (
            <>
              <strong>{openCount}</strong> open support {openCount === 1 ? "ticket" : "tickets"}
            </>
          )}
          {openCount > 0 && unreadCount > 0 && <span className="mx-2 opacity-70">·</span>}
          {unreadCount > 0 && (
            <>
              <strong>{unreadCount}</strong> unread {unreadCount === 1 ? "message" : "messages"}
            </>
          )}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs opacity-90">
          View inbox <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
