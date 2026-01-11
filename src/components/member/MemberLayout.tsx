import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MemberSidebar } from "./MemberSidebar";
import { AnnualFeeNotice } from "./AnnualFeeNotice";
import { PaymentDueNotice } from "./PaymentDueNotice";
import { ActivationRequiredNotice } from "./ActivationRequiredNotice";
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
        
        <div className="flex flex-1">
          <MemberSidebar />
          <SidebarInset className="flex-1">
            <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                {title && (
                  <h1 className="text-lg font-semibold">{title}</h1>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </header>
            <main className="p-6">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
