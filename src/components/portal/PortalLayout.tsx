import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { PortalSidebar } from "./PortalSidebar";
import { PortalBottomNav } from "./PortalBottomNav";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { Link } from "react-router-dom";
import { MemorialDayHoursBanner } from "@/components/member/MemorialDayHoursBanner";
import { MaintenanceJuly23Banner } from "@/components/member/MaintenanceJuly23Banner";
import { PortalPhoneGate } from "./PortalPhoneGate";
import { NonMemberSmsOptInGate } from "./NonMemberSmsOptInGate";
import { MilestoneCelebrationHost } from "@/components/member/MilestoneCelebrationHost";
import { AchievementCelebrationHost } from "@/components/member/AchievementCelebrationHost";

interface PortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function PortalLayout({ children, title }: PortalLayoutProps) {
  const { profile, isLoading } = useNonMemberProfile();
  const hasPhone = !!profile?.phone?.trim();

  if (profile && !isLoading && !hasPhone) {
    return <PortalPhoneGate />;
  }

  return (
    <SidebarProvider>
      <NonMemberSmsOptInGate />
      <div className="min-h-screen flex flex-col w-full bg-background">
        <MaintenanceJuly23Banner />
        <MemorialDayHoursBanner />



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
        <MilestoneCelebrationHost />
        <AchievementCelebrationHost />
      </div>
    </SidebarProvider>
  );
}
