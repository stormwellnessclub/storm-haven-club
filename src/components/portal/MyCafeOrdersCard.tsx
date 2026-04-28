import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coffee, Clock } from "lucide-react";
import { format } from "date-fns";
import { useMyCafeOrders, type CafeOrder } from "@/hooks/useCafeOrder";
import { useAuth } from "@/contexts/AuthContext";
import { useReliableRealtime } from "@/hooks/useReliableRealtime";

const ACTIVE: CafeOrder["status"][] = ["pending", "preparing", "ready"];

const STATUS_LABEL: Record<CafeOrder["status"], string> = {
  pending: "Order received",
  preparing: "Being prepared",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<CafeOrder["status"], string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  preparing: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 animate-pulse",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

/**
 * Customer-facing live tracker for their own cafe orders.
 * Subscribes to realtime updates filtered to the current user_id, so the
 * status badge updates within ~1s when staff click "Mark Ready".
 */
export function MyCafeOrdersCard() {
  const { user } = useAuth();
  const { data: orders = [] } = useMyCafeOrders();
  const queryClient = useQueryClient();

  useReliableRealtime({
    channelName: `my-cafe-orders-${user?.id ?? "anon"}`,
    listeners: user
      ? [
          {
            event: "*",
            table: "cafe_orders",
            filter: `user_id=eq.${user.id}`,
            callback: () => {
              queryClient.invalidateQueries({ queryKey: ["cafe-orders", user.id] });
            },
          },
        ]
      : [],
  });

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  if (active.length === 0) return null;

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coffee className="h-4 w-4 text-amber-600" />
          Your Cafe Order{active.length > 1 ? "s" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {active.map((order) => (
          <div key={order.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Order #{order.id.slice(0, 8)}</div>
              <Badge variant="outline" className={STATUS_COLOR[order.status]}>
                {STATUS_LABEL[order.status]}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {(order.order_items || [])
                .filter((i) => i.category !== "Tax" && i.category !== "Fee")
                .map((i, idx) => (
                  <div key={idx}>
                    {i.quantity}× {i.name}
                  </div>
                ))}
            </div>
            {order.estimated_ready_at && order.status !== "ready" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Ready around {format(new Date(order.estimated_ready_at), "h:mm a")}
              </div>
            )}
            {order.status === "ready" && (
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Pick it up at the cafe counter ☕
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
