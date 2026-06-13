import { useState, useEffect } from "react";
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
  History,
  Trophy,
  Dumbbell,
  CheckCircle2,
  Target,
  Settings,
  Sparkles,
  Receipt,
  ScanLine,
  Zap,
  Gift,
  ChevronDown,
  ShoppingBag,
  Baby,
  Coffee,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import stormLogo from "@/assets/storm-logo-gold.png";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  highlighted?: boolean;
}

// Always-visible top items
const mainItems: MenuItem[] = [
  { title: "Dashboard", url: "/member", icon: LayoutDashboard },
  { title: "Member Entry", url: "/member/entry", icon: ScanLine },
  { title: "Support", url: "/member/support", icon: MessageCircle },
  { title: "Cafe Order", url: "/member/cafe", icon: Coffee },
  { title: "Storm Shop", url: "/shop", icon: ShoppingBag },
];

interface SidebarGroupDef {
  label: string;
  items: MenuItem[];
}

const collapsibleGroups: SidebarGroupDef[] = [
  {
    label: "Membership & Billing",
    items: [
      { title: "My Membership", url: "/member/membership", icon: IdCard },
      { title: "My Credits", url: "/member/credits", icon: CreditCard },
      { title: "Payment Methods", url: "/member/payment-methods", icon: Wallet },
      { title: "Payment History", url: "/member/payment-history", icon: Receipt },
      { title: "Buy Passes", url: "/class-passes", icon: Ticket },
    ],
  },
  {
    label: "Bookings & Visits",
    items: [
      { title: "My Bookings", url: "/member/bookings", icon: Calendar },
      { title: "Visit History", url: "/member/check-in-history", icon: Activity },
      { title: "Kids Care", url: "/member/kids-care", icon: Baby },
      { title: "Wellness Booking", url: "/member/wellness", icon: Zap },
    ],
  },
  {
    label: "Health & Wellness",
    items: [
      { title: "Health Score", url: "/member/health-score", icon: Activity },
      { title: "Workouts", url: "/member/workouts", icon: Dumbbell, highlighted: true },
      { title: "Habits", url: "/member/habits", icon: CheckCircle2 },
      { title: "Goals", url: "/member/goals", icon: Target },
      { title: "Achievements", url: "/member/achievements", icon: Trophy },
      { title: "Fitness Profile", url: "/member/fitness-profile", icon: Settings },
    ],
  },
  {
    label: "Account",
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

  // Determine which groups should be open based on active route
  const getDefaultOpen = () => {
    const open: string[] = [];
    collapsibleGroups.forEach((group) => {
      if (group.items.some((item) => isActive(item.url))) {
        open.push(group.label);
      }
    });
    return open;
  };

  const [openGroups, setOpenGroups] = useState<string[]>(getDefaultOpen);

  // Update open groups when route changes
  useEffect(() => {
    const active = getDefaultOpen();
    if (active.length > 0) {
      setOpenGroups((prev) => {
        const merged = new Set([...prev, ...active]);
        return [...merged];
      });
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={stormLogo} alt="Storm Wellness" className="h-8 w-8 object-contain" />
          {!isCollapsed && (
            <div>
              <h2 className="font-semibold text-sm">Storm Wellness</h2>
              <p className="text-xs text-muted-foreground">Member Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main - always visible */}
        <SidebarGroup className="pt-4">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/member"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collapsible groups */}
        {collapsibleGroups.map((group) => (
          <Collapsible
            key={group.label}
            open={openGroups.includes(group.label)}
            onOpenChange={() => toggleGroup(group.label)}
          >
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      openGroups.includes(group.label) && "rotate-180"
                    )}
                  />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                          <NavLink to={item.url} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            {item.highlighted && (
                              <Sparkles className="h-3 w-3 text-primary ml-auto" />
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Website">
              <NavLink to="/">
                <Home className="h-4 w-4" />
                <span>Back to Website</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
