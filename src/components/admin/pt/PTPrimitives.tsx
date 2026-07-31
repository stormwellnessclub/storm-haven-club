import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ------------------------------------------------------------------ buttons */

export function ptButtonClass(variant: "primary" | "ghost" | "outline" | "gold" | "danger" = "primary") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  if (variant === "primary") return cn(base, "bg-pt-noir text-pt-cream hover:bg-pt-noir-soft");
  if (variant === "gold") return cn(base, "bg-pt-gold text-pt-noir hover:bg-pt-gold/90");
  if (variant === "outline") return cn(base, "border border-pt-line bg-white text-pt-ink hover:bg-pt-beige/50");
  if (variant === "danger") return cn(base, "bg-pt-red text-white hover:bg-pt-red/90");
  return cn(base, "text-pt-muted hover:text-pt-ink hover:bg-pt-beige/50");
}

/* ------------------------------------------------------------------- layout */

export function PTPageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="pt-eyebrow mb-1">{eyebrow}</div>}
        <h1 className="pt-serif text-3xl sm:text-[2.2rem] leading-tight text-pt-ink">{title}</h1>
        {subtitle && <p className="text-sm text-pt-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PTCard({
  className, children, padded = true,
}: { className?: string; children: ReactNode; padded?: boolean }) {
  return <div className={cn("pt-card", padded && "p-4", className)}>{children}</div>;
}

export function PTSectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
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

/* ------------------------------------------------------------------- badges */

export type PTBadgeTone = "neutral" | "gold" | "green" | "amber" | "red" | "noir";

export function PTBadge({
  children, tone = "neutral", className,
}: { children: ReactNode; tone?: PTBadgeTone; className?: string }) {
  const map: Record<PTBadgeTone, string> = {
    neutral: "bg-pt-beige text-pt-ink",
    gold: "bg-pt-gold/15 text-pt-gold",
    green: "bg-pt-green/10 text-pt-green",
    amber: "bg-pt-amber/15 text-pt-amber",
    red: "bg-pt-red/10 text-pt-red",
    noir: "bg-pt-noir text-pt-cream",
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
      map[tone], className,
    )}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, PTBadgeTone> = {
  scheduled: "neutral",
  confirmed: "green",
  unconfirmed: "neutral",
  completed: "green",
  cancelled: "neutral",
  late_cancel: "amber",
  no_show: "red",
  checked_in: "gold",
  unpaid: "red",
  paid: "green",
  comp: "neutral",
  pass: "neutral",
  active: "green",
  expired: "red",
  paused: "amber",
  prospect: "gold",
  todo: "neutral",
  in_progress: "amber",
  done: "green",
};

export function PTStatus({ status }: { status: string }) {
  return (
    <PTBadge tone={STATUS_TONE[status] ?? "neutral"} className="capitalize">
      {status.replace(/_/g, " ")}
    </PTBadge>
  );
}

/* -------------------------------------------------------------------- table */

export interface PTColumn<T> {
  key: string;
  header: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

export function PTTable<T>({
  columns, rows, getRowKey, onRowClick, empty, loading, dense,
}: {
  columns: PTColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  loading?: boolean;
  dense?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 rounded-md bg-pt-beige/50 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!rows.length) return <>{empty ?? <PTEmptyState title="Nothing here yet" />}</>;

  return (
    <div className="overflow-x-auto pt-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-pt-line">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "pt-eyebrow font-medium px-3 py-2 whitespace-nowrap",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={getRowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-pt-line/60 last:border-0 text-pt-ink",
                onRowClick && "cursor-pointer hover:bg-pt-beige/40 transition-colors",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    dense ? "px-3 py-1.5" : "px-3 py-2.5",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    c.className,
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------- tabs */

export function PTTabs<T extends string>({
  tabs, value, onChange, className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-pt-line overflow-x-auto pt-scroll", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "whitespace-nowrap px-3 py-2.5 text-[13px] border-b-2 -mb-px transition-colors",
              active
                ? "border-pt-gold text-pt-ink font-medium"
                : "border-transparent text-pt-muted hover:text-pt-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-[11px] text-pt-muted">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- modal */

export function PTModal({
  open, onOpenChange, title, description, children, footer, size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" }[size];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("pt-portal bg-pt-cream border-pt-line max-h-[90vh] overflow-y-auto pt-scroll", width)}>
        <DialogHeader>
          <DialogTitle className="pt-serif text-2xl text-pt-ink">{title}</DialogTitle>
          {description && <DialogDescription className="text-pt-muted">{description}</DialogDescription>}
        </DialogHeader>
        <div className="text-pt-ink">{children}</div>
        {footer && <DialogFooter className="gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function PTConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel",
  onConfirm, destructive,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="pt-portal bg-pt-cream border-pt-line">
        <AlertDialogHeader>
          <AlertDialogTitle className="pt-serif text-xl text-pt-ink">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-pt-muted">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-pt-line bg-white text-pt-ink hover:bg-pt-beige/50">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            className={destructive ? "bg-pt-red text-white hover:bg-pt-red/90" : "bg-pt-noir text-pt-cream hover:bg-pt-noir-soft"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ----------------------------------------------------------------- dropdown */

export interface PTMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export function PTDropdown({
  trigger, items, label, align = "end",
}: { trigger: ReactNode; items: PTMenuItem[]; label?: string; align?: "start" | "end" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="pt-portal bg-white border-pt-line min-w-52">
        {label && <DropdownMenuLabel className="pt-eyebrow">{label}</DropdownMenuLabel>}
        {items.map((item, i) => (
          <div key={`${item.label}-${i}`}>
            {item.separatorBefore && <DropdownMenuSeparator className="bg-pt-line" />}
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); item.onSelect?.(); }}
              className={cn(
                "text-[13px] cursor-pointer focus:bg-pt-beige/60",
                item.destructive ? "text-pt-red focus:text-pt-red" : "text-pt-ink",
              )}
            >
              {item.icon && <item.icon className="h-4 w-4 mr-2" />}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------- alert */

export function PTAlert({
  tone = "info", title, children, action,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const config = {
    info: { cls: "border-pt-line bg-pt-beige/50 text-pt-ink", Icon: Info, iconCls: "text-pt-gold" },
    success: { cls: "border-pt-green/30 bg-pt-green/10 text-pt-ink", Icon: CheckCircle2, iconCls: "text-pt-green" },
    warning: { cls: "border-pt-amber/40 bg-pt-amber/10 text-pt-ink", Icon: AlertTriangle, iconCls: "text-pt-amber" },
    danger: { cls: "border-pt-red/30 bg-pt-red/10 text-pt-ink", Icon: XCircle, iconCls: "text-pt-red" },
  }[tone];
  const Icon = config.Icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", config.cls)}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.iconCls)} />
      <div className="min-w-0 flex-1">
        {title && <div className="text-[13px] font-medium">{title}</div>}
        {children && <div className="text-[13px] text-pt-muted mt-0.5">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- timeline */

export interface PTTimelineItem {
  id: string;
  time?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  tone?: "default" | "gold" | "green" | "amber" | "red";
  onClick?: () => void;
}

export function PTTimeline({ items, empty }: { items: PTTimelineItem[]; empty?: ReactNode }) {
  if (!items.length) return <>{empty ?? <PTEmptyState title="Nothing scheduled" />}</>;
  const dotTone = {
    default: "bg-pt-line",
    gold: "bg-pt-gold",
    green: "bg-pt-green",
    amber: "bg-pt-amber",
    red: "bg-pt-red",
  };
  return (
    <ol className="relative pl-5">
      <span className="absolute left-[6px] top-1 bottom-1 w-px bg-pt-line" aria-hidden />
      {items.map((item) => (
        <li
          key={item.id}
          onClick={item.onClick}
          className={cn(
            "relative py-3 border-b border-pt-line/60 last:border-0",
            item.onClick && "cursor-pointer hover:bg-pt-beige/30 rounded-md -mx-2 px-2 transition-colors",
          )}
        >
          <span className={cn("absolute -left-[15px] top-[18px] h-2.5 w-2.5 rounded-full ring-4 ring-pt-cream", dotTone[item.tone ?? "default"])} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-pt-ink truncate">{item.title}</div>
              {item.description && <div className="text-xs text-pt-muted mt-0.5">{item.description}</div>}
            </div>
            <div className="text-right shrink-0">
              {item.time && <div className="text-[13px] text-pt-ink tabular-nums">{item.time}</div>}
              {item.meta && <div className="text-xs text-pt-muted mt-0.5">{item.meta}</div>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------- empty state */

export function PTEmptyState({
  icon: Icon, title, description, action, className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center gap-2 py-12 px-6 rounded-xl border border-dashed border-pt-line",
      className,
    )}>
      {Icon && (
        <div className="h-10 w-10 rounded-full grid place-items-center bg-pt-beige/70 mb-1">
          <Icon className="h-4 w-4 text-pt-gold" />
        </div>
      )}
      <div className="text-[14px] font-medium text-pt-ink">{title}</div>
      {description && <p className="text-[13px] text-pt-muted max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Legacy alias kept for existing pages. */
export function PTEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="text-center py-10 text-sm text-pt-muted border border-dashed border-pt-line rounded-xl">
      {children}
    </div>
  );
}
