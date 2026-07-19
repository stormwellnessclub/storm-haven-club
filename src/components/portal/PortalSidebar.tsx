import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Calendar,
  
  Ticket,
  MessageCircle,
  LogOut,
  Home,
  Wallet,
  Receipt,
  Zap,
  ShoppingBag,
  Coffee,
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

const portalMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/portal", icon: LayoutDashboard },
  { title: "My Bookings", url: "/portal/bookings", icon: Calendar },
  { title: "My Passes", url: "/portal/passes", icon: Ticket },
  { title: "Events", url: "/events", icon: Sparkles },
  { title: "My Tickets", url: "/portal/my-tickets", icon: Ticket },
  
  
  { title: "Buy Passes", url: "/class-passes", icon: CreditCard },
  { title: "Recovery Booking", url: "/portal/wellness", icon: Zap },
  { title: "Cafe Order", url: "/portal/cafe", icon: Coffee },
  { title: "Storm Shop", url: "/shop", icon: ShoppingBag },
  { title: "Payment Methods", url: "/portal/payment-methods", icon: Wallet },
  { title: "Payment History", url: "/portal/payment-history", icon: Receipt },
  { title: "Support", url: "/portal/support", icon: MessageCircle },
  { title: "Profile", url: "/portal/profile", icon: User },
];

export function PortalSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/portal") return location.pathname === "/portal";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={stormLogo} alt="Storm Wellness" className="h-8 w-8 object-contain" />
          {!isCollapsed && (
            <div>
              <h2 className="font-semibold text-sm text-sidebar-foreground">Storm Wellness</h2>
              <p className="text-xs text-sidebar-foreground/70">Class Portal</p>
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
              {portalMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/portal"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
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
              onClick={() => signOut()}
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
