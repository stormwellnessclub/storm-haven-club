import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, Users, Dumbbell, NotebookPen, TrendingUp, Package,
  UserCog, ListChecks, MessageSquare, BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut, User, ArrowLeft, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ROLE_LABELS } from "@/lib/permissions";
import { usePTShellCounts } from "@/hooks/pt/usePTShell";
import { PTDropdown } from "@/components/admin/pt/PTPrimitives";

export interface PTNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "tasks" | "messages";
}

export const PT_NAV: PTNavItem[] = [
  { label: "Dashboard", to: "/admin/pt", icon: LayoutDashboard, end: true },
  { label: "Schedule", to: "/admin/pt/schedule", icon: CalendarDays },
  { label: "Clients", to: "/admin/pt/clients", icon: Users },
  { label: "Programs", to: "/admin/pt/programs", icon: Dumbbell },
  { label: "Session Notes", to: "/admin/pt/session-notes", icon: NotebookPen },
  { label: "Progress Tracking", to: "/admin/pt/progress", icon: TrendingUp },
  { label: "Packages", to: "/admin/pt/packages", icon: Package },
  { label: "Billing & Autopay", to: "/admin/pt/billing", icon: CreditCard },
  { label: "Trainers", to: "/admin/pt/trainers", icon: UserCog },
  { label: "Tasks", to: "/admin/pt/tasks", icon: ListChecks, badge: "tasks" },
  { label: "Messages", to: "/admin/pt/messages", icon: MessageSquare, badge: "messages" },
  { label: "Reports", to: "/admin/pt/reports", icon: BarChart3 },
  { label: "Settings", to: "/admin/pt/settings", icon: Settings },
];

export function usePTStaffIdentity() {
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const roleLabel = useMemo(() => {
    const order = ["super_admin", "admin", "manager", "class_instructor", "front_desk"] as const;
    const top = order.find((r) => roles.includes(r as any));
    return top ? ROLE_LABELS[top as keyof typeof ROLE_LABELS] : "Staff";
  }, [roles]);
  const email = user?.email ?? "";
  const name = (user?.user_metadata as any)?.full_name || email.split("@")[0] || "Staff";
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");
  return { email, name, initials: initials || "SW", roleLabel };
}

function NavBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-pt-gold px-1.5 text-[11px] font-semibold text-pt-noir">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function PTSidebar({
  collapsed, onToggle, mobileOpen, onMobileClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { name, initials, roleLabel } = usePTStaffIdentity();
  const { data: counts } = usePTShellCounts();

  useEffect(() => { onMobileClose(); /* close drawer on route change */ }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const badgeFor = (item: PTNavItem) => {
    if (item.badge === "tasks") return counts?.openTasks ?? 0;
    if (item.badge === "messages") return counts?.openMessages ?? 0;
    return 0;
  };

  const content = (
    <div className="flex h-full flex-col bg-pt-noir text-pt-cream">
      {/* Brand */}
      <div className={cn("flex items-center gap-2 h-16 px-3 border-b border-white/10", collapsed && "justify-center px-0")}>
        <div className="h-9 w-9 shrink-0 rounded-lg bg-pt-gold grid place-items-center text-pt-noir font-semibold">S</div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[13px] font-medium leading-tight truncate">Personal Training</div>
            <div className="text-[11px] text-pt-cream/50 leading-tight truncate">Storm Wellness Club</div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "ml-auto hidden lg:grid h-7 w-7 place-items-center rounded-md text-pt-cream/60 hover:text-pt-cream hover:bg-white/10 transition-colors",
            collapsed && "ml-0 absolute left-1/2 -translate-x-1/2 top-[52px]",
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto pt-scroll py-3", collapsed ? "px-2 pt-6" : "px-2")}>
        <ul className="space-y-0.5">
          {PT_NAV.map((item) => {
            const badge = badgeFor(item);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-white/10 text-pt-cream font-medium"
                      : "text-pt-cream/60 hover:text-pt-cream hover:bg-white/5",
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-pt-gold" />}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed ? <NavBadge count={badge} /> : badge > 0 && (
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-pt-gold" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-2">
        <PTDropdown
          align="start"
          label={name}
          trigger={
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5 transition-colors",
                collapsed && "justify-center px-0",
              )}
            >
              <span className="h-8 w-8 shrink-0 rounded-full bg-pt-gold/20 border border-pt-gold/40 grid place-items-center text-[11px] font-semibold text-pt-gold">
                {initials}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block text-[13px] leading-tight truncate">Storm Wellness Club</span>
                  <span className="block text-[11px] text-pt-cream/50 leading-tight truncate">{roleLabel}</span>
                </span>
              )}
            </button>
          }
          items={[
            { label: "My profile", icon: User, onSelect: () => navigate("/admin/pt/settings") },
            { label: "Portal settings", icon: Settings, onSelect: () => navigate("/admin/pt/settings") },
            { label: "Back to Admin", icon: ArrowLeft, onSelect: () => navigate("/admin"), separatorBefore: true },
            {
              label: "Sign out",
              icon: LogOut,
              destructive: true,
              separatorBefore: true,
              onSelect: async () => { await signOut(); navigate("/auth"); },
            },
          ]}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-pt-noir/60" onClick={onMobileClose} />
          <div className="absolute inset-y-0 left-0 w-64">{content}</div>
        </div>
      )}
    </>
  );
}
