import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarDays,
  ClipboardList,
  Users,
  CalendarClock,
  UserX,
  Repeat,
  StickyNote,
  DollarSign,
  MessageSquare,
  FileText,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

const NAV = [
  { key: "today",         label: "Today",          to: "/instructor",              icon: LayoutDashboard },
  { key: "schedule",      label: "My Schedule",    to: "/instructor/schedule",     icon: CalendarDays },
  { key: "rosters",       label: "Rosters",        to: "/instructor/rosters",      icon: Users },
  { key: "availability",  label: "Availability",   to: "/instructor/availability", icon: CalendarClock },
  { key: "timeoff",       label: "Time Off",       to: "/instructor/time-off",     icon: UserX },
  { key: "subs",          label: "Subs & Swaps",   to: "/instructor/subs",         icon: Repeat },
  { key: "notes",         label: "Class Notes",    to: "/instructor/notes",        icon: StickyNote },
  { key: "pay",           label: "Hours & Pay",    to: "/instructor/pay",          icon: DollarSign, divide: true },
  { key: "messages",      label: "Messages",       to: "/instructor/messages",     icon: MessageSquare },
  { key: "documents",     label: "Documents",      to: "/instructor/documents",    icon: FileText },
] as const;

interface Me {
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export function InstructorShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("instructors")
      .select("first_name,last_name,photo_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data && setMe(data));
  }, [user]);

  const displayName = me ? `${me.first_name} ${me.last_name}` : "Instructor";
  const initials = me ? `${me.first_name[0] ?? ""}${me.last_name[0] ?? ""}`.toUpperCase() : "";

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex min-h-screen w-full bg-[#FAF9F6] font-sans text-[#1A1A1A]">
      <aside className="hidden md:flex w-64 flex-col border-r border-[#E5E2DD] bg-[#F5F2ED] p-6">
        <div className="mb-10 px-2">
          <h1
            style={{ fontFamily: "'Instrument Serif', serif" }}
            className="text-2xl italic tracking-tight text-[#1A1A1A]"
          >
            Storm
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-[#C5A059] mt-1">Instructor Portal</p>
        </div>

        <nav className="flex flex-1 flex-col space-y-1">
          {NAV.map((item) => {
            const active =
              item.to === "/instructor"
                ? location.pathname === "/instructor"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {"divide" in item && item.divide && <div className="my-4 border-t border-[#E5E2DD]" />}
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[#E5E2DD] font-medium text-[#1A1A1A]"
                      : "font-normal text-gray-600 hover:bg-[#E5E2DD]/50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-[#E5E2DD] pt-6">
          {me?.photo_url ? (
            <img src={me.photo_url} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-[#C5A059]/20 flex items-center justify-center text-xs font-medium text-[#C5A059]">
              {initials}
            </div>
          )}
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <span className="text-xs font-medium truncate">{displayName}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Instructor</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500 hover:text-[#1A1A1A]"
            title="Sign out"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </aside>

      {/* Mobile top strip */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#F5F2ED] border-b border-[#E5E2DD] overflow-x-auto">
        <nav className="flex gap-1 px-3 py-2 min-w-max">
          {NAV.map((item) => {
            const active =
              item.to === "/instructor"
                ? location.pathname === "/instructor"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap",
                  active ? "bg-[#1A1A1A] text-white" : "text-gray-700",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export { format };
