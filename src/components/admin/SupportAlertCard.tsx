import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";

export function SupportAlertCard() {
  const { data: notifications, error } = useAdminSupportNotifications();

  if (error) {
    console.error("Support alert card could not render notifications:", error);
    return null;
  }

  if (!notifications || (notifications.openCount === 0 && notifications.unreadCount === 0)) {
    return null;
  }

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-primary">
                Member Support Messages
              </p>
              <p className="text-sm text-muted-foreground">
                {notifications.openCount > 0 && `${notifications.openCount} open ticket(s)`}
                {notifications.openCount > 0 && notifications.unreadCount > 0 && ' · '}
                {notifications.unreadCount > 0 && `${notifications.unreadCount} unread message(s)`}
              </p>
            </div>
          </div>
          <Button variant="outline" asChild className="border-primary/50 hover:bg-primary/10">
            <Link to="/admin/emails">
              View Messages
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
