import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, LayoutGrid, Users, ShieldCheck, PlaneTakeoff, DollarSign, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV = [
  { to: '/schedule/today', label: 'Today', icon: LayoutGrid, end: true },
  { to: '/schedule/builder', label: 'Schedule', icon: CalendarDays, end: false },
  { to: '/schedule/team', label: 'Team', icon: Users, end: false },
  { to: '/schedule/coverage', label: 'Coverage rules', icon: ShieldCheck, end: false },
  { to: '/schedule/time-off', label: 'Time off', icon: PlaneTakeoff, end: false },
  { to: '/schedule/hours', label: 'Hours & cost', icon: DollarSign, end: false },
];

export function ScheduleShell({
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
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Storm Wellness Club</div>
              <div className="font-semibold leading-tight">Staff Scheduling</div>
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
                  'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
                  active
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
