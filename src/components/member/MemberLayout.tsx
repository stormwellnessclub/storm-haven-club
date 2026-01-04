import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MemberSidebar } from "./MemberSidebar";
import { AnnualFeeNotice } from "./AnnualFeeNotice";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemberLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function MemberLayout({ children, title }: MemberLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full bg-background">
        <AnnualFeeNotice />
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
