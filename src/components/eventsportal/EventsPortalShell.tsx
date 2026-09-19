import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  LayoutGrid,
  Sparkles,
  Layers,
  Inbox,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/events-portal", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/events-portal/calendar", label: "Calendar", icon: CalendarDays, end: false },
  { to: "/events-portal/events", label: "All events", icon: Sparkles, end: false },
  { to: "/events-portal/collections", label: "Collections", icon: Layers, end: false },
  { to: "/events-portal/requests", label: "Requests & waitlists", icon: Inbox, end: false },
  { to: "/events-portal/attendance", label: "Attendance", icon: ClipboardCheck, end: false },
];

export function EventsPortalShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </a>
            </Button>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Storm Wellness Club
              </div>
              <div className="font-semibold leading-tight">Events Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex gap-1 px-3 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl text-primary">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
