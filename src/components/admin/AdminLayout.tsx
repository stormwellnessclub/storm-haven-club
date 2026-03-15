import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";
import { AdminSupportChime, getIsMuted, setIsMuted } from "./AdminSupportChime";
import { useState } from "react";
import { BellOff } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { data: notifications } = useAdminSupportNotifications();
  const [muted, setMuted] = useState(getIsMuted);
  
  const notificationCount = notifications?.openCount || 0;

  const toggleMute = () => {
    const next = !muted;
    setIsMuted(next);
    setMuted(next);
  };

  return (
    <SidebarProvider>
      <AdminSupportChime />
      <div className="min-h-screen flex flex-col md:flex-row w-full bg-background">
        <AdminSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <header className="h-14 sm:h-16 border-b border-border flex items-center justify-between px-3 sm:px-4 bg-card sticky top-0 z-40">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <SidebarTrigger className="touch-target" />
              {title && (
                <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="touch-target"
                onClick={toggleMute}
                title={muted ? "Unmute notifications" : "Mute notifications"}
              >
                {muted ? <BellOff className="h-5 w-5 text-muted-foreground" /> : <Bell className="h-5 w-5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative touch-target"
                onClick={() => navigate('/admin/emails')}
                title="Support Messages"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Button>
              <Button variant="ghost" size="icon" className="touch-target">
                <User className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="p-4 sm:p-6 safe-area-bottom">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
