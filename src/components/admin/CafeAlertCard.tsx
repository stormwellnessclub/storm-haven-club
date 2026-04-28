import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coffee, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminCafeNotifications } from "@/hooks/useAdminCafeNotifications";

export function CafeAlertCard() {
  const { data: notifications, error } = useAdminCafeNotifications();

  if (error) {
    console.error("Cafe alert card could not render notifications:", error);
    return null;
  }

  if (!notifications || notifications.totalActiveCount === 0) {
    return null;
  }

  const { pendingCount, preparingCount } = notifications;

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Coffee className="h-6 w-6 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Cafe Orders Waiting
              </p>
              <p className="text-sm text-muted-foreground">
                {pendingCount > 0 && `${pendingCount} new order(s)`}
                {pendingCount > 0 && preparingCount > 0 && " · "}
                {preparingCount > 0 && `${preparingCount} preparing`}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            asChild
            className="border-amber-500/50 hover:bg-amber-500/10"
          >
            <Link to="/admin/cafe">
              View Orders
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
