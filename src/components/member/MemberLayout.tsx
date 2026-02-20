import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MemberSidebar } from "./MemberSidebar";
import { AnnualFeeNotice } from "./AnnualFeeNotice";
import { PaymentDueNotice } from "./PaymentDueNotice";
import { ActivationRequiredNotice } from "./ActivationRequiredNotice";
import { WaiverReminderNotice } from "./WaiverReminderNotice";
import { SoftLaunchHoursBanner } from "./SoftLaunchHoursBanner";
import { ClassScheduleBanner } from "@/components/ClassScheduleBanner";
import { WifiBanner } from "./WifiBanner";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { User } from "lucide-react";
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        {/* Soft launch hours banner */}
        <SoftLaunchHoursBanner />
        <ClassScheduleBanner />
        <WifiBanner />
        
        {/* Activation notice for pending_activation members */}
        {isPendingActivation && membership && (
          <div className="p-4 border-b border-border">
            <ActivationRequiredNotice 
              memberData={{
                first_name: membership.first_name,
                activation_deadline: membership.activation_deadline || null,
                membership_type: membership.membership_type,
              }} 
            />
          </div>
        )}
        
        {/* Payment due notice for members with payment issues (initiation fee or subscription) */}
        {!isPendingActivation && hasPaymentIssues && <PaymentDueNotice />}
        
        {/* Annual fee renewal notice (only for members who have paid initially but need to renew) */}
        {!isPendingActivation && isInitiationFeePaid && <AnnualFeeNotice />}
        
        {/* Waiver reminder notice for members who haven't signed required waivers */}
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
                <Button variant="ghost" size="icon" className="touch-target">
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </header>
            <PWAInstallPrompt />
            <main className="p-4 sm:p-6 safe-area-bottom">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
