import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  QrCode,
  ClipboardList,
  FileText,
  FileBarChart,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  Home,
  User,
  Ticket,
  Coffee,
  Baby,
  Dumbbell,
  Shield,
  UserCog,
  UserPlus,
  MessageSquare,
  Snowflake,
  ScanLine,
  BarChart3,
  TrendingUp,
  FileWarning,
  Sparkles,
  Megaphone,
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
import { useUserRoles } from "@/hooks/useUserRoles";
import { canAccessPage, type AppRole } from "@/lib/permissions";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  highlight?: boolean;
  requiredRoles?: AppRole[];
}

const quickAccessItems: MenuItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Soft Launch Classes", url: "/admin/classes?tab=soft-launch", icon: Calendar, highlight: true, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Check-In", url: "/admin/check-in", icon: QrCode, highlight: true, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Check-In History", url: "/admin/check-in-history", icon: ClipboardList, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Scanner", url: "/admin/scanner", icon: ScanLine, highlight: true, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
];

const managementItems: MenuItem[] = [
  { title: "People", url: "/admin/people", icon: UsersRound, highlight: true, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Members", url: "/admin/members", icon: Users, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Member Credits", url: "/admin/member-credits", icon: CreditCard, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Freeze Requests", url: "/admin/freeze-requests", icon: Snowflake, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Applications", url: "/admin/applications", icon: FileText, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Appointments", url: "/admin/appointments", icon: Calendar, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff'] },
  { title: "Payments", url: "/admin/payments", icon: CreditCard, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Payment Tracking", url: "/admin/payment-tracking", icon: FileWarning, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Payment Reports", url: "/admin/payment-reports", icon: BarChart3, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Revenue Analytics", url: "/admin/revenue-analytics", icon: TrendingUp, requiredRoles: ['super_admin'] },
  { title: "Reports", url: "/admin/reports", icon: FileBarChart, requiredRoles: ['super_admin'] },
  { title: "Guest Passes", url: "/admin/guest-passes", icon: Ticket, requiredRoles: ['super_admin', 'manager', 'front_desk'] },
  { title: "Guest Accounts", url: "/admin/guests", icon: Users, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Marketing", url: "/admin/marketing", icon: Megaphone, requiredRoles: ['super_admin', 'admin'] },
  { title: "Non-Member Accounts", url: "/admin/non-member-accounts", icon: UserPlus, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
];

const servicesItems: MenuItem[] = [
  { title: "Today's Classes", url: "/admin/classes", icon: Calendar, requiredRoles: ['super_admin', 'admin', 'class_instructor'] },
  { title: "Class Management", url: "/admin/class-types", icon: Dumbbell, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Instructors", url: "/admin/instructors", icon: UserCog, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Cafe POS", url: "/admin/cafe", icon: Coffee, requiredRoles: ['super_admin', 'admin', 'cafe_staff'] },
  { title: "Front Desk POS", url: "/admin/front-desk", icon: Sparkles, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff'] },
  { title: "Childcare", url: "/admin/childcare", icon: Baby, requiredRoles: ['super_admin', 'admin', 'childcare_staff'] },
];

const systemItems: MenuItem[] = [
  { title: "Staff Management", url: "/admin/staff-roles", icon: Shield, requiredRoles: ['super_admin', 'admin'] },
  { title: "Equipment", url: "/admin/equipment", icon: Dumbbell, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Agreements", url: "/admin/agreements", icon: FileText, requiredRoles: ['super_admin', 'admin', 'manager'] },
  { title: "Support", url: "/admin/emails", icon: MessageSquare, requiredRoles: ['super_admin', 'admin', 'manager', 'front_desk'] },
  { title: "Settings", url: "/admin/settings", icon: Settings, requiredRoles: ['super_admin', 'admin'] },
];

export function AdminSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { signOut, user } = useAuth();
  const { roles } = useUserRoles();
  const isCollapsed = state === "collapsed";
  const [todaysGuestCount, setTodaysGuestCount] = useState(0);
  const [hasMembership, setHasMembership] = useState(false);

  // Check if staff member also has an active membership
  useEffect(() => {
    if (!user) return;
    supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "frozen", "past_due"])
      .maybeSingle()
      .then(({ data }) => {
        setHasMembership(!!data);
      });
  }, [user]);

  // Fetch today's guest count
  useEffect(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("guest_passes" as any)
      .select("id", { count: "exact", head: true })
      .eq("valid_date", todayStr)
      .eq("status", "active")
      .then(({ count }) => {
        setTodaysGuestCount(count || 0);
      });
  }, []);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  const filterMenuItems = (items: MenuItem[]) => {
    return items.filter(item => {
      if (!item.requiredRoles) return true;
      return canAccessPage(roles, item.url);
    });
  };

  const filteredQuickAccess = filterMenuItems(quickAccessItems);
  const filteredManagement = filterMenuItems(managementItems);
  const filteredServices = filterMenuItems(servicesItems);
  const filteredSystem = filterMenuItems(systemItems);

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
              <p className="text-xs text-muted-foreground">Admin Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Quick Access */}
        {filteredQuickAccess.length > 0 && (
          <SidebarGroup className="pt-4">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
              Quick Access
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredQuickAccess.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={item.highlight && !isActive(item.url) ? "bg-accent/20 hover:bg-accent/30" : ""}
                    >
                      <NavLink to={item.url} end={item.url === "/admin"}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Management */}
        {filteredManagement.length > 0 && (
          <SidebarGroup className="pt-4">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagement.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.url === "/admin/guest-passes" && todaysGuestCount > 0 && !isCollapsed && (
                          <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                            {todaysGuestCount}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Services */}
        {filteredServices.length > 0 && (
          <SidebarGroup className="pt-4">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
              Services
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredServices.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System */}
        {filteredSystem.length > 0 && (
          <SidebarGroup className="pt-4">
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-2">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSystem.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border space-y-2">
        <SidebarMenu>
          {hasMembership && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="My Membership">
                <NavLink to="/member">
                  <User className="h-4 w-4" />
                  <span>My Membership</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
