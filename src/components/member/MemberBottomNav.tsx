import { NavLink, useLocation } from "react-router-dom";
import { CalendarPlus, Activity, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpcomingBookings } from "@/hooks/useBooking";

const tabs = [
  { label: "Book", icon: CalendarPlus, path: "/member/book" },
  { label: "Activity", icon: Activity, path: "/member/check-in-history", badgeFromUpcoming: true },
  { label: "Support", icon: MessageCircle, path: "/member/support" },
  { label: "Account", icon: User, path: "/member/profile" },
];

export function MemberBottomNav() {
  const location = useLocation();
  const { data: upcomingBookings } = useUpcomingBookings();
  const upcomingCount = upcomingBookings?.length ?? 0;

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50 md:hidden bg-[hsl(38_25%_6%)] text-[hsl(48_16%_84%)] rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const badge = tab.badgeFromUpcoming && upcomingCount > 0 ? upcomingCount : null;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-medium transition-colors",
                active
                  ? "text-[hsl(var(--gold-light))]"
                  : "text-[hsl(48_16%_72%)] hover:text-[hsl(48_16%_92%)]"
              )}
            >
              <div className="relative">
                <tab.icon className="h-5 w-5" />
                {badge !== null && (
                  <span className="absolute -top-1.5 -right-2 bg-[hsl(var(--gold))] text-[hsl(38_25%_6%)] text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
