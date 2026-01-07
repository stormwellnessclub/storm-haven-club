import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  CreditCard,
  IdCard,
  Calendar,
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
  Sparkles,
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
import stormLogo from "@/assets/storm-logo-gold.png";
import { useAuth } from "@/contexts/AuthContext";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

const memberMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/member", icon: LayoutDashboard },
  { title: "My Profile", url: "/member/profile", icon: User },
  { title: "My Credits", url: "/member/credits", icon: CreditCard },
  { title: "My Membership", url: "/member/membership", icon: IdCard },
  { title: "Payment Methods", url: "/member/payment-methods", icon: Wallet },
  { title: "My Bookings", url: "/member/bookings", icon: Calendar },
  { title: "Freeze Request", url: "/member/freeze", icon: Snowflake },
  { title: "Waivers", url: "/member/waivers", icon: FileCheck },
  { title: "Support", url: "/member/support", icon: MessageCircle },
];

const wellnessMenuItems: MenuItem[] = [
  { title: "Health Score", url: "/member/health-score", icon: Activity },
  { title: "Achievements", url: "/member/achievements", icon: Trophy },
  { title: "Workouts", url: "/member/workouts", icon: Dumbbell },
  { title: "Habits", url: "/member/habits", icon: CheckCircle2 },
  { title: "Goals", url: "/member/goals", icon: Target },
  { title: "Fitness Profile", url: "/member/fitness-profile", icon: Settings },
];

// Highlight workouts item with AI badge
const HIGHLIGHTED_ITEMS = ["Workouts"];

export function MemberSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/member") {
      return location.pathname === "/member";
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src={stormLogo}
            alt="Storm Wellness"
            className="h-8 w-8 object-contain"
          />
          {!isCollapsed && (
            <div>
              <h2 className="font-semibold text-sm">Storm Wellness</h2>
              <p className="text-xs text-muted-foreground">Member Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="pt-4">
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
            My Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {memberMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
            Health & Wellness
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {wellnessMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {HIGHLIGHTED_ITEMS.includes(item.title) && (
                        <Sparkles className="h-3 w-3 text-primary ml-auto" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
