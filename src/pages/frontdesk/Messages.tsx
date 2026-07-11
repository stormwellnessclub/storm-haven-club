import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import EmailManagement from "@/pages/admin/EmailManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, Lock } from "lucide-react";

/**
 * /frontdesk/messages — Support / Concierge inbox for Front Desk staff.
 *
 * Reuses the admin EmailManagement page inside the FrontDesk shell. Because
 * email_conversations / email_messages RLS require an authenticated staff
 * user, this tab (unlike the rest of Front Desk which is PIN-only) requires
 * a Supabase session with the `front_desk`, `manager`, `admin`, or
 * `super_admin` role.
 */
export default function FrontDeskMessagesPage() {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const location = useLocation();

  const authorized =
    !!user &&
    roles.some((r) =>
      ["front_desk", "manager", "admin", "super_admin"].includes(r),
    );

  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        {loading || rolesLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : authorized ? (
          <EmailManagement />
        ) : (
          <div className="p-6 max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Staff sign-in required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MessageCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  Member support and concierge messages are only visible to
                  staff accounts. Sign in with your staff email to view and
                  reply to conversations.
                </p>
                <Button asChild className="w-full">
                  <Link
                    to={`/auth?redirect=${encodeURIComponent(location.pathname)}`}
                  >
                    Sign in
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
