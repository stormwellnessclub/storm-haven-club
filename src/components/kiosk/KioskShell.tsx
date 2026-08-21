import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { KioskPinGate } from "@/components/kiosk/KioskPinGate";
import { AdminSupportChime } from "@/components/admin/AdminSupportChime";
import { ChimeSoundControls } from "@/components/admin/ChimeSoundControls";

import { AdminCafeChime } from "@/components/admin/AdminCafeChime";
import { AudioUnlocker } from "@/components/admin/AudioUnlocker";
import {
  UserCheck, Coffee, Sparkles, GraduationCap, Lock, Home,
} from "lucide-react";
import stormLogo from "@/assets/storm-logo-gold.png";
import { format } from "date-fns";

interface KioskShellProps {
  /** Visible label shown in the header chip, e.g. "Cafe Mode". */
  label: string;
  /** Active mode key for highlighting the nav. */
  mode: "reception" | "cafe" | "spa" | "classes";
  children: ReactNode;
}

const MODES = [
  { key: "reception", label: "Reception", to: "/kiosk/reception", icon: UserCheck },
  { key: "cafe",      label: "Cafe",      to: "/kiosk/cafe",      icon: Coffee },
  { key: "spa",       label: "Spa",       to: "/kiosk/spa",       icon: Sparkles },
  { key: "classes",   label: "Classes",   to: "/kiosk/classes",   icon: GraduationCap },
] as const;

/**
 * Shared shell for all /kiosk/* pages.
 * - Single PIN gate (shared sessionStorage key with /front-desk)
 * - No admin sidebar — staff only see the focused tools they need
 * - Persistent mode switcher in the header so they can hop between stations
 * - Mounts the cafe + support chimes globally so alerts fire in any mode
 */
export function KioskShell({ label, mode, children }: KioskShellProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const location = useLocation();
  useEffect(() => {
    if (sessionStorage.getItem("kioskUnlocked") === "true") setUnlocked(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!unlocked) {
    return <KioskPinGate onUnlock={() => setUnlocked(true)} />;
  }

  const handleLock = async () => {
    sessionStorage.removeItem("kioskUnlocked");
    setUnlocked(false);
  };

  return (
    <>
      <AudioUnlocker />
      <AdminSupportChime />
      <AdminCafeChime />

      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-30">
          <div className="px-4 py-2 flex items-center gap-3">
            <img src={stormLogo} alt="Storm" className="h-8 w-8 object-contain shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Kiosk</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>

            {/* Mode switcher */}
            <nav className="ml-4 flex items-center gap-1 overflow-x-auto">
              {MODES.map(({ key, label, to, icon: Icon }) => {
                const active = mode === key || location.pathname === to;
                return (
                  <Link key={key} to={to}>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "default" : "ghost"}
                      className="gap-1.5 h-8 px-2.5"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{label}</span>
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <ChimeSoundControls compact />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {format(now, "EEE, MMM d • h:mm a")}
              </span>

              <Link to="/admin" className="hidden md:inline">
                <Button type="button" size="sm" variant="ghost" className="gap-1.5 h-8 px-2.5">
                  <Home className="h-3.5 w-3.5" />
                  <span className="text-xs">Admin</span>
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleLock}
                className="gap-1.5 h-8 px-2.5"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="text-xs">Lock</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 min-h-0">{children}</main>
      </div>
    </>
  );
}
