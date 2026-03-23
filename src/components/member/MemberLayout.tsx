import { useMemo } from "react";
import { Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MemberSidebar } from "./MemberSidebar";
import { MemberBottomNav } from "./MemberBottomNav";
import { NotificationBar, NotificationItem } from "./NotificationBar";
import { AnnualFeeNotice } from "./AnnualFeeNotice";
import { PaymentDueNotice } from "./PaymentDueNotice";
import { ActivationRequiredNotice } from "./ActivationRequiredNotice";
import { WaiverReminderNotice } from "./WaiverReminderNotice";


import { WifiBanner } from "./WifiBanner";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { User, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserMembership } from "@/hooks/useUserMembership";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";

interface MemberLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MemberLayout({ children, title }: MemberLayoutProps) {
  const { data: membership } = useUserMembership();
  const { hasPaymentIssues, isInitiationFeePaid } = usePaymentStatus();
  
  const isPendingActivation = membership?.status === "pending_activation";

  // Build notification items for consolidated bar
  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    if (isPendingActivation && membership) {
      items.push({
        id: "activation",
        priority: 1,
        content: (
          <span>
            Complete your membership activation to unlock all benefits.{" "}
            <Link to="/member/membership" className="font-medium underline">
              Activate Now
            </Link>
          </span>
        ),
      });
    }

    if (!isPendingActivation && hasPaymentIssues) {
      items.push({
        id: "payment_due",
        priority: 2,
        content: (
          <span>
            You have a payment issue that needs attention.{" "}
            <Link to="/member/payment-methods" className="font-medium underline">
              Update Payment
            </Link>
          </span>
        ),
      });
    }

    if (!isPendingActivation && isInitiationFeePaid) {
      items.push({
        id: "annual_fee",
        priority: 3,
        content: "Your annual fee renewal is coming up.",
      });
    }

    return items;
  }, [isPendingActivation, membership, hasPaymentIssues, isInitiationFeePaid]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        {/* Consolidated notification bar */}
        <NotificationBar items={notifications} />
        
        {/* Info banners */}
        <SoftLaunchHoursBanner />
        
        <WifiBanner />
        
        {/* Waiver reminder (keeps its own logic) */}
        <WaiverReminderNotice />
        
        <div className="flex flex-1 flex-col md:flex-row">
          <MemberSidebar />
          <SidebarInset className="flex-1 min-w-0">
            <header className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-4 bg-card sticky top-0 z-40">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <SidebarTrigger className="touch-target" />
                {title && (
                  <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="sm" className="touch-target gap-1.5" asChild>
                  <Link to="/member/support">
                    <MessageCircle className="h-5 w-5" />
                    <span className="hidden sm:inline text-xs">Support</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" className="touch-target">
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </header>
            <PWAInstallPrompt />
            <main className="p-4 sm:p-6 pb-20 md:pb-6 safe-area-bottom">
              {children}
            </main>
          </SidebarInset>
        </div>
        
        {/* Mobile bottom tab bar */}
        <MemberBottomNav />
      </div>
    </SidebarProvider>
  );
}
