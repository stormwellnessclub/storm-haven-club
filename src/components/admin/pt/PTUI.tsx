import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export const PT_NAV = [
  { label: "Dashboard", to: "/admin/pt" },
  { label: "Schedule", to: "/admin/pt/schedule" },
  { label: "Clients", to: "/admin/pt/clients" },
  { label: "Programs", to: "/admin/pt/programs" },
  { label: "Packages", to: "/admin/personal-training/packs" },
  { label: "Trainers", to: "/admin/personal-training/trainers" },
  { label: "Payments", to: "/admin/personal-training/payments" },
];

export function PTShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AdminLayout>
      <div className="pt-portal min-h-screen">
        <nav className="border-b border-pt-line bg-white/70 backdrop-blur px-4 sm:px-8">
          <div className="max-w-[1500px] mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
            {PT_NAV.map((item) => {
              const active = item.to === "/admin/pt" ? pathname === "/admin/pt" : pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "whitespace-nowrap px-3 py-3 text-[13px] tracking-wide border-b-2 transition-colors",
                    active
                      ? "border-pt-gold text-pt-ink font-medium"
                      : "border-transparent text-pt-muted hover:text-pt-ink"
                  )}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 py-6">{children}</div>
      </div>
    </AdminLayout>
  );
}

export function PTPageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && <div className="pt-eyebrow mb-1">{eyebrow}</div>}
        <h1 className="pt-serif text-3xl sm:text-[2.2rem] leading-tight text-pt-ink">{title}</h1>
        {subtitle && <p className="text-sm text-pt-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PTCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("pt-card p-4", className)}>{children}</div>;
}

export function PTSectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="pt-eyebrow">{children}</h2>
      {action}
    </div>
  );
}

export function PTKpiCard({
  label, value, hint, icon: Icon, tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "gold" | "green" | "amber" | "red";
}) {
  const toneClass = {
    default: "text-pt-ink",
    gold: "text-pt-gold",
    green: "text-pt-green",
    amber: "text-pt-amber",
    red: "text-pt-red",
  }[tone];
  return (
    <div className="pt-card p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="pt-eyebrow">{label}</div>
        <div className={cn("pt-serif text-3xl mt-1", toneClass)}>{value}</div>
        {hint && <div className="text-xs text-pt-muted mt-1 truncate">{hint}</div>}
      </div>
      {Icon && (
        <div className="h-9 w-9 rounded-full grid place-items-center bg-pt-beige/70 shrink-0">
          <Icon className="h-4 w-4 text-pt-gold" />
        </div>
      )}
    </div>
  );
}

export function PTStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-pt-beige text-pt-ink",
    completed: "bg-pt-green/10 text-pt-green",
    cancelled: "bg-pt-line/50 text-pt-muted",
    late_cancel: "bg-pt-amber/15 text-pt-amber",
    no_show: "bg-pt-red/10 text-pt-red",
    checked_in: "bg-pt-gold/15 text-pt-gold",
    unpaid: "bg-pt-red/10 text-pt-red",
    paid: "bg-pt-green/10 text-pt-green",
    comp: "bg-pt-line/50 text-pt-muted",
    pass: "bg-pt-beige text-pt-ink",
    active: "bg-pt-green/10 text-pt-green",
  };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
      map[status] ?? "bg-pt-beige text-pt-ink"
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function PTEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="text-center py-10 text-sm text-pt-muted border border-dashed border-pt-line rounded-xl">
      {children}
    </div>
  );
}

export function ptButtonClass(variant: "primary" | "ghost" | "outline" = "primary") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  if (variant === "primary") return cn(base, "bg-pt-noir text-pt-cream hover:bg-pt-noir-soft");
  if (variant === "outline") return cn(base, "border border-pt-line bg-white text-pt-ink hover:bg-pt-beige/50");
  return cn(base, "text-pt-muted hover:text-pt-ink hover:bg-pt-beige/50");
}
