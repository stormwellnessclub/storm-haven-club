import { NavLink, useLocation } from "react-router-dom";
import { Home, CalendarPlus, ScanLine, CreditCard, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", icon: Home, path: "/member", exact: true },
  { label: "Book", icon: CalendarPlus, path: "/member/schedule" },
  { label: "Entry", icon: ScanLine, path: "/member/entry" },
  { label: "Credits", icon: CreditCard, path: "/member/credits" },
];

export function MemberBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.path, tab.exact);
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.exact}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "text-primary")} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium text-muted-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
