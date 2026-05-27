import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { PortalSidebar } from "./PortalSidebar";
import { PortalBottomNav } from "./PortalBottomNav";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { MemorialDayHoursBanner } from "@/components/member/MemorialDayHoursBanner";
import { PortalPhoneGate } from "./PortalPhoneGate";

interface PortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function PortalLayout({ children, title }: PortalLayoutProps) {
  const { profile, isLoading } = useNonMemberProfile();
  const hasCard = profile?.card_last4;
  const hasPhone = !!profile?.phone?.trim();

  if (profile && !isLoading && !hasPhone) {
    return <PortalPhoneGate />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        <MemorialDayHoursBanner />
        {/* Card on file requirement banner */}
        {profile && !hasCard && (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3">
            <Alert variant="destructive" className="border-0 bg-transparent p-0">
              <CreditCard className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2">
                <span>A payment method is required.</span>
                <Link to="/portal/payment-methods" className="underline font-medium">
                  Add a card now
                </Link>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex flex-1 flex-col md:flex-row">
          <PortalSidebar />
          <SidebarInset className="flex-1 min-w-0">
            <header className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-4 bg-card sticky top-0 z-40">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <SidebarTrigger className="touch-target" />
                {title && (
                  <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" className="touch-target" asChild>
                  <Link to="/portal/profile">
                    <User className="h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </header>
            <main className="p-4 sm:p-6 pb-20 md:pb-6 safe-area-bottom">
              {children}
            </main>
          </SidebarInset>
        </div>
        <PortalBottomNav />
      </div>
    </SidebarProvider>
  );
}
