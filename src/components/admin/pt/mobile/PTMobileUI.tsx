import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Inbox } from "lucide-react";

/**
 * Mobile-first UI primitives for the PT trainer app.
 * Shares the Noir / Cream / Gold tokens used by the desktop portal.
 */

export function PTMCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border border-pt-line bg-pt-cream shadow-[0_1px_2px_rgba(33,28,23,0.05)]",
        onClick && "active:scale-[0.995] transition-transform",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function PTMLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-pt-gold", className)}>
      {children}
    </p>
  );
}

export function PTMSectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-pt-ink">{children}</h2>
      {action}
    </div>
  );
}

export function PTMStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex-1 rounded-xl border border-pt-line bg-pt-cream px-3 py-3 text-center">
      <p className="text-[11px] text-pt-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-pt-ink">{value}</p>
    </div>
  );
}

export function PTMBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "green" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-pt-beige text-pt-muted",
    gold: "bg-pt-gold/15 text-pt-gold",
    green: "bg-pt-green/12 text-pt-green",
    amber: "bg-pt-amber/15 text-pt-amber",
    red: "bg-pt-red/12 text-pt-red",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function ptmButtonClass(variant: "primary" | "gold" | "outline" | "ghost" | "danger" = "primary") {
  const base =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 min-h-[52px] text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-pt-noir text-pt-cream active:bg-pt-noir-soft",
    gold: "bg-pt-gold text-pt-noir active:opacity-90",
    outline: "border border-pt-line bg-pt-cream text-pt-ink active:bg-pt-beige",
    ghost: "text-pt-muted active:bg-pt-beige",
    danger: "text-pt-red active:bg-pt-red/10",
  };
  return cn(base, variants[variant]);
}

export function PTMSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-pt-beige", className)} />;
}

export function PTMListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <PTMSkeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function PTMEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-pt-line bg-pt-cream px-6 py-10 text-center">
      <Inbox className="mx-auto h-6 w-6 text-pt-muted" />
      <p className="mt-3 text-[15px] font-semibold text-pt-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-pt-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PTMError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-pt-red/30 bg-pt-red/5 px-5 py-6 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-pt-red" />
      <p className="mt-2 text-sm text-pt-ink">{message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className={cn(ptmButtonClass("outline"), "mt-4")}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Sticky bottom action bar that clears the tab bar and the home indicator. */
export function PTMStickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-pt-line bg-pt-cream/95 px-4 pt-3 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function PTMRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left min-h-[56px] active:bg-pt-beige/60"
    >
      {icon && <span className="text-pt-ink">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-pt-ink">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-pt-muted">{subtitle}</span>}
      </span>
      {right}
    </Comp>
  );
}
