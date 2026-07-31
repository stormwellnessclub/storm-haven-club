import { ReactNode, useEffect, useState } from "react";
import { PTSidebar } from "@/components/admin/pt/PTSidebar";
import { PTTopBar } from "@/components/admin/pt/PTTopBar";
import { cn } from "@/lib/utils";

export * from "@/components/admin/pt/PTPrimitives";
export { PT_NAV } from "@/components/admin/pt/PTSidebar";

const COLLAPSE_KEY = "pt-portal-sidebar-collapsed";

/** Global application shell for the Personal Training portal. */
export function PTShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="pt-portal min-h-screen bg-pt-cream">
      <PTSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <PTTopBar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1500px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
