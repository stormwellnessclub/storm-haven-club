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
  KeyRound,
  ShieldX,
  UserCog,
  UserPlus,
  MessageSquare,
  Mail,
  Snowflake,
  ScanLine,
  BarChart3,
  TrendingUp,
  FileWarning,
  Sparkles,
  Gift,
  Megaphone,
  ShoppingBag,
  ShoppingCart,
  ChevronDown,
  MessagesSquare,
  Monitor,
  CalendarDays,
  History,
  Heart,
  AlertCircle,
  Leaf,
  GraduationCap,
  Tag,
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
import { useUserRoles } from "@/hooks/useUserRoles";
import { useUnresolvedFailedCount } from "@/hooks/useUnresolvedFailedCount";
import { canAccessPage, type AppRole } from "@/lib/permissions";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  highlight?: boolean;
}

interface DepartmentSection {
  label: string;
  roles: AppRole[];
  items: MenuItem[];
  defaultOpen?: boolean;
}

const departments: DepartmentSection[] = [
  {
    label: 'Operations',
    roles: ['super_admin', 'admin', 'manager', 'front_desk'],
    defaultOpen: true,
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
      { title: "Check-In", url: "/admin/check-in", icon: QrCode, highlight: true },
      { title: "Check-In History", url: "/admin/check-in-history", icon: ClipboardList },
      { title: "Scanner", url: "/admin/scanner", icon: ScanLine, highlight: true },
      { title: "Directory", url: "/admin/people", icon: UsersRound, highlight: true },
      { title: "Members", url: "/admin/members", icon: Users },
      { title: "Guest Passes", url: "/admin/guest-passes", icon: Ticket },
      { title: "Guest Accounts", url: "/admin/guests", icon: Users },
      { title: "Non-Member Accounts", url: "/admin/non-member-accounts", icon: UserPlus },
      { title: "Support", url: "/admin/emails", icon: MessageSquare },
      { title: "Staff Hub", url: "/admin/staff-hub", icon: MessagesSquare, highlight: true },
      { title: "Staff Schedule", url: "/admin/staff-schedule", icon: CalendarDays, highlight: true },
      { title: "Front Desk Mode", url: "/front-desk", icon: Monitor, highlight: true },
    ],
  },
  {
    label: 'Membership Management',
    roles: ['super_admin', 'admin', 'manager', 'front_desk'],
    items: [
      { title: "Applications", url: "/admin/applications", icon: FileText },
      { title: "Member Credits", url: "/admin/member-credits", icon: CreditCard },
      { title: "Freeze Requests", url: "/admin/freeze-requests", icon: Snowflake },
      { title: "Agreements", url: "/admin/agreements", icon: FileText },
      { title: "Signature Certificates", url: "/admin/signature-certificates", icon: FileText },
    ],
  },
  {
    label: 'Classes',
    roles: ['super_admin', 'admin', 'manager', 'class_instructor'],
    defaultOpen: true,
    items: [
      { title: "Today's Classes", url: "/admin/classes", icon: Calendar },
      { title: "Class Management", url: "/admin/class-types", icon: Dumbbell },
      { title: "Class Schedules", url: "/admin/class-schedules", icon: CalendarDays },
      { title: "Class Pass Pricing", url: "/admin/class-pass-pricing", icon: Tag },
      { title: "Instructors", url: "/admin/instructors", icon: UserCog },
      { title: "Instructor Portal", url: "/instructor", icon: GraduationCap },
      { title: "Class Pass Abandoned", url: "/admin/abandoned-class-pass-checkouts", icon: ShoppingCart },
    ],
  },
  {
    label: 'Wellness & Spa',
    roles: ['super_admin', 'admin', 'manager', 'spa_staff', 'front_desk'],
    items: [
      { title: "Appointments", url: "/admin/appointments", icon: Calendar },
      { title: "Spa Management", url: "/admin/spa-management", icon: Calendar },
      { title: "Mother's Day 💛", url: "/admin/mothers-day", icon: Heart, highlight: true },
      { title: "MD Class Packs 🎁", url: "/admin/mothers-day-class-packs", icon: Heart, highlight: true },
      { title: "Front Desk POS", url: "/admin/front-desk", icon: Sparkles },
      { title: "Gift Cards", url: "/admin/gift-cards", icon: Gift },
      { title: "Gut Reset", url: "/admin/gut-reset", icon: Leaf },
    ],
  },
  {
    label: 'Personal Training',
    roles: ['super_admin', 'admin', 'manager', 'front_desk'],
    items: [
      { title: "Training Requests", url: "/admin/training-requests", icon: Dumbbell },
      { title: "PT Schedule", url: "/admin/personal-training/schedule", icon: Calendar },
      { title: "PT Customers & Passes", url: "/admin/personal-training/passes", icon: Ticket },
      { title: "PT Packs & Pricing", url: "/admin/personal-training/packs", icon: ClipboardList },
      { title: "PT Session Payments", url: "/admin/personal-training/payments", icon: DollarSign },
    ],
  },
  {
    label: 'Cafe & Retail',
    roles: ['super_admin', 'admin', 'manager', 'cafe_staff'],
    items: [
      { title: "Cafe POS", url: "/admin/cafe", icon: Coffee },
      { title: "Cafe Menu", url: "/admin/cafe-menu", icon: Coffee },
      { title: "Storm Shop", url: "/admin/merch", icon: ShoppingBag },
    ],
  },
  {
    label: 'Childcare',
    roles: ['super_admin', 'admin', 'childcare_staff'],
    items: [
      { title: "Childcare", url: "/admin/childcare", icon: Baby },
    ],
  },
  {
    label: 'Finance',
    roles: ['super_admin', 'admin', 'manager'],
    items: [
      { title: "Payments", url: "/admin/payments", icon: CreditCard },
      { title: "Payment Tracking", url: "/admin/payment-tracking", icon: FileWarning },
      { title: "Failed Payments History", url: "/admin/payments/failed-history", icon: History, highlight: true },
      { title: "Billing Emails", url: "/admin/billing-emails", icon: Mail },
      { title: "Billing Arrears", url: "/admin/billing-arrears", icon: AlertCircle, highlight: true },
      { title: "Payment Reports", url: "/admin/payment-reports", icon: BarChart3 },
      { title: "Revenue Analytics", url: "/admin/revenue-analytics", icon: TrendingUp },
      { title: "Reports", url: "/admin/reports", icon: FileBarChart },
    ],
  },
  {
    label: 'Administration',
    roles: ['super_admin', 'admin'],
    items: [
      { title: "Staff Management", url: "/admin/staff-roles", icon: Shield },
      { title: "Staff PINs", url: "/admin/staff-pins", icon: KeyRound },
      { title: "Blocked Persons", url: "/admin/blocked", icon: ShieldX },
      { title: "Equipment", url: "/admin/equipment", icon: Dumbbell },
      { title: "Marketing", url: "/admin/marketing", icon: Megaphone },
      { title: "Events", url: "/admin/events", icon: Sparkles },
      { title: "Email Templates", url: "/admin/email-templates", icon: MessageSquare },
      { title: "Settings", url: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { signOut, user } = useAuth();
  const { roles } = useUserRoles();
  const isCollapsed = state === "collapsed";
  const [todaysGuestCount, setTodaysGuestCount] = useState(0);
  const [hasMembership, setHasMembership] = useState(false);
  const unresolvedFailedCount = useUnresolvedFailedCount();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "frozen", "past_due"])
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load sidebar membership status:", error);
          setHasMembership(false);
          return;
        }

        setHasMembership(!!data);
      });
  }, [user]);

  useEffect(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("guest_passes" as any)
      .select("id", { count: "exact", head: true })
      .eq("valid_date", todayStr)
      .eq("status", "active")
      .then(({ count, error }) => {
        if (error) {
          console.error("Failed to load today's guest count:", error);
          setTodaysGuestCount(0);
          return;
        }

        setTodaysGuestCount(count || 0);
      });
  }, []);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  // Check if user has any of the department's required roles
  const canSeeDepartment = (dept: DepartmentSection) => {
    if (roles.includes('super_admin')) return true;
    return dept.roles.some(r => roles.includes(r));
  };

  // Filter items within a department by page permission
  const filterItems = (items: MenuItem[]) => {
    return items.filter(item => canAccessPage(roles, item.url));
  };

  // Check if any item in department is currently active
  const isDeptActive = (dept: DepartmentSection) => {
    return dept.items.some(item => isActive(item.url));
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
              <p className="text-xs text-muted-foreground">Staff Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {departments.map((dept) => {
          if (!canSeeDepartment(dept)) return null;
          const visibleItems = filterItems(dept.items);
          if (visibleItems.length === 0) return null;

          return (
            <Collapsible
              key={dept.label}
              defaultOpen={dept.defaultOpen || isDeptActive(dept)}
              className="group/collapsible"
            >
              <SidebarGroup className="pt-3">
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-1 flex items-center justify-between cursor-pointer hover:text-muted-foreground transition-colors">
                    <span>{dept.label}</span>
                    {!isCollapsed && (
                      <ChevronDown className="h-3 w-3 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map((item) => (
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
                              {item.url === "/admin/guest-passes" && todaysGuestCount > 0 && !isCollapsed && (
                                <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                                  {todaysGuestCount}
                                </span>
                              )}
                              {item.url === "/admin/payments/failed-history" && unresolvedFailedCount > 0 && !isCollapsed && (
                                <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
                                  {unresolvedFailedCount}
                                </span>
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
          );
        })}
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
