import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Bell, Coffee, User, Volume2, VolumeX, Play, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";
import { useAdminCafeNotifications } from "@/hooks/useAdminCafeNotifications";
import { AdminSupportChime, getIsMuted, setIsMuted, playNotificationChime, unlockChimeAudio, isAudioBlocked } from "./AdminSupportChime";
import { AdminCafeChime } from "./AdminCafeChime";
import { AudioUnlocker } from "./AudioUnlocker";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { RealtimeStatus } from "@/hooks/useReliableRealtime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBareAdminLayout } from "./BareAdminLayoutContext";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

function statusColor(s: RealtimeStatus) {
  switch (s) {
    case "connected": return "bg-emerald-500";
    case "connecting": return "bg-amber-400 animate-pulse";
    case "error":
    case "closed": return "bg-destructive";
    default: return "bg-muted-foreground";
  }
}

function statusLabel(s: RealtimeStatus) {
  switch (s) {
    case "connected": return "Live notifications connected";
    case "connecting": return "Connecting…";
    case "error": return "Notification connection error — retrying";
    case "closed": return "Notification connection closed — retrying";
    default: return "Idle";
  }
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const bare = useBareAdminLayout();
  const navigate = useNavigate();
  const { data: notifications } = useAdminSupportNotifications();
  const { data: cafeNotifications } = useAdminCafeNotifications();
  const [muted, setMuted] = useState(getIsMuted);
  const [supportStatus, setSupportStatus] = useState<RealtimeStatus>("idle");
  const [cafeStatus, setCafeStatus] = useState<RealtimeStatus>("idle");
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Poll the browser audio state so we can prompt for a single unlock tap.
  useEffect(() => {
    const check = () => setAudioBlocked(isAudioBlocked());
    check();
    const id = setInterval(check, 2000);
    return () => clearInterval(id);
  }, []);



  // When embedded inside a kiosk shell, render the page body only.
  // The shell already provides chrome, chimes, and audio unlock.
  if (bare) {
    return <div className="p-4 sm:p-6 safe-area-bottom">{children}</div>;
  }


  const notificationCount = notifications?.openCount || 0;
  const cafeCount = cafeNotifications?.totalActiveCount || 0;

  // Worst of the two states drives the indicator
  const worstStatus: RealtimeStatus =
    supportStatus === "error" || cafeStatus === "error" ? "error" :
    supportStatus === "closed" || cafeStatus === "closed" ? "closed" :
    supportStatus === "connecting" || cafeStatus === "connecting" ? "connecting" :
    supportStatus === "connected" && cafeStatus === "connected" ? "connected" :
    "idle";

  const toggleMute = () => {
    const next = !muted;
    setIsMuted(next);
    setMuted(next);
  };

  return (
    <SidebarProvider>
      <AudioUnlocker />
      <AdminSupportChime onStatusChange={setSupportStatus} />
      <AdminCafeChime onStatusChange={setCafeStatus} />
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
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor(worstStatus)}`}
                      aria-label={statusLabel(worstStatus)}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="text-xs">
                      <div>{statusLabel(worstStatus)}</div>
                      <div className="text-muted-foreground mt-1">
                        Support: {supportStatus} · Cafe: {cafeStatus}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {audioBlocked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse"
                  onClick={async () => {
                    await unlockChimeAudio();
                    setAudioBlocked(isAudioBlocked());
                    playNotificationChime();
                  }}
                  title="Your browser is blocking notification sounds — tap once to enable"
                >
                  <BellRing className="h-4 w-4" />
                  <span className="hidden sm:inline">Enable sound</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="touch-target"
                onClick={async () => {
                  await unlockChimeAudio();
                  setAudioBlocked(isAudioBlocked());
                  playNotificationChime();
                  toast.success("Test chime played");
                }}
                title="Test notification sound"
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="touch-target"
                onClick={toggleMute}
                title={muted ? "Sound muted — notifications are silent" : "Mute notifications"}
              >
                {muted ? <VolumeX className="h-5 w-5 text-destructive" /> : <Volume2 className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="relative touch-target"
                onClick={() => navigate('/admin/cafe')}
                title="Cafe Orders"
              >
                <Coffee className="h-5 w-5" />
                {cafeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center animate-pulse">
                    {cafeCount > 9 ? '9+' : cafeCount}
                  </span>
                )}
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
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-pulse">
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
