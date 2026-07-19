import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  User,
  CreditCard,
  IdCard,
  Calendar,
  Ticket,
  FileCheck,
  MessageCircle,
  LogOut,
  Home,
  Snowflake,
  Wallet,
  Activity,
  Trophy,
  Dumbbell,
  CheckCircle2,
  Target,
  Settings,
  Receipt,
  ScanLine,
  Zap,
  Gift,
  ShoppingBag,
  Baby,
  Coffee,
  Heart,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import stormLogo from "@/assets/storm-logo-gold.png";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface SidebarGroupDef {
  label: string;
  items: MenuItem[];
}

const sidebarGroups: SidebarGroupDef[] = [
  {
    label: "MAIN",
    items: [
      { title: "Dashboard", url: "/member", icon: LayoutDashboard },
      { title: "Member Entry", url: "/member/entry", icon: ScanLine },
      { title: "Support", url: "/member/support", icon: MessageCircle },
      { title: "Café Order", url: "/member/cafe", icon: Coffee },
      { title: "Storm Shop", url: "/shop", icon: ShoppingBag },
    ],
  },
  {
    label: "MEMBERSHIP & BILLING",
    items: [
      { title: "My Membership", url: "/member/membership", icon: IdCard },
      { title: "My Credits", url: "/member/credits", icon: CreditCard },
      { title: "Payment Methods", url: "/member/payment-methods", icon: Wallet },
      { title: "Payment History", url: "/member/payment-history", icon: Receipt },
      { title: "Buy Passes", url: "/class-passes", icon: Ticket },
    ],
  },
  {
    label: "BOOKINGS & VISITS",
    items: [
      { title: "My Bookings", url: "/member/bookings", icon: Calendar },
      { title: "Visit History", url: "/member/check-in-history", icon: Activity },
      { title: "Kids Care", url: "/member/kids-care", icon: Baby },
      { title: "Wellness Booking", url: "/member/wellness", icon: Zap },
    ],
  },
  {
    label: "HEALTH & WELLNESS",
    items: [
      { title: "Health Score", url: "/member/health-score", icon: Heart },
      { title: "Workouts", url: "/member/workouts", icon: Dumbbell },
      { title: "Habits", url: "/member/habits", icon: CheckCircle2 },
      { title: "Goals", url: "/member/goals", icon: Target },
      { title: "Achievements", url: "/member/achievements", icon: Trophy },
      { title: "Fitness Profile", url: "/member/fitness-profile", icon: Settings },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { title: "My Profile", url: "/member/profile", icon: User },
      { title: "Waivers", url: "/member/waivers", icon: FileCheck },
      { title: "Freeze Request", url: "/member/freeze", icon: Snowflake },
      { title: "Register Guest", url: "/member/credits", icon: Gift },
      { title: "Refer a Friend", url: "/member/referrals", icon: Users },
    ],
  },
];

export function MemberSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/member") return location.pathname === "/member";
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{
        // Force dark noir theme on the sidebar regardless of app theme
        ["--sidebar-background" as any]: "38 25% 6%",
        ["--sidebar-foreground" as any]: "48 16% 84%",
        ["--sidebar-border" as any]: "38 25% 12%",
      }}
    >
      <SidebarHeader className="p-5 border-b border-[hsl(38_25%_12%)]">
        <div className="flex flex-col items-center gap-1 py-2">
          <img src={stormLogo} alt="Storm Wellness" className="h-9 w-9 object-contain" />
          {!isCollapsed && (
            <>
              <h2 className="font-serif text-lg tracking-[0.35em] text-[hsl(var(--gold-light))] mt-2">
                STORM
              </h2>
              <p className="text-[9px] tracking-[0.3em] text-[hsl(var(--gold))]/80">
                WELLNESS CLUB
              </p>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 gap-1 overflow-y-auto">
        {sidebarGroups.map((group) => (
          <div key={group.label} className="mt-3">
            {!isCollapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.18em] text-[hsl(var(--gold))]/85">
                {group.label}
              </div>
            )}
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.url);
                return (
                  <NavLink
                    key={item.url + item.title}
                    to={item.url}
                    end={item.url === "/member"}
                    title={isCollapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold-light))]"
                        : "text-[hsl(48_16%_72%)] hover:bg-white/[0.04] hover:text-[hsl(48_16%_92%)]"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.title}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-[hsl(38_25%_12%)]">
        <NavLink
          to="/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-[hsl(48_16%_72%)] hover:bg-white/[0.04] hover:text-[hsl(48_16%_92%)]"
        >
          <Home className="h-4 w-4" />
          {!isCollapsed && <span>Back to Website</span>}
        </NavLink>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-[hsl(0_75%_65%)] hover:bg-[hsl(0_75%_65%)]/10"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
