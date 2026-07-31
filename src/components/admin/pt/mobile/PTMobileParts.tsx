import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Info, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PTMBadge, ptmButtonClass } from "./PTMobileUI";

/** ---------------- Bottom sheet ---------------- */
export function PTMSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-pt-line bg-pt-cream px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-pt-line" />
        {title && (
          <SheetHeader className="mb-3 text-left">
            <SheetTitle className="text-pt-ink">{title}</SheetTitle>
            {description && <p className="text-[13px] text-pt-muted">{description}</p>}
          </SheetHeader>
        )}
        <div className="pb-2">{children}</div>
        {footer && <div className="sticky bottom-0 -mx-4 border-t border-pt-line bg-pt-cream px-4 pt-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

/** ---------------- Confirmation dialog ---------------- */
export function PTMConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-32px)] max-w-sm rounded-2xl border-pt-line bg-pt-cream">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-pt-ink">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-pt-muted">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(ptmButtonClass(destructive ? "gold" : "primary"), destructive && "bg-pt-red text-pt-cream")}
          >
            {confirmLabel}
          </AlertDialogAction>
          <AlertDialogCancel className={ptmButtonClass("outline")}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** ---------------- Accordion section ---------------- */
export function PTMAccordion({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-pt-line bg-pt-cream">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[15px] font-semibold text-pt-ink">{title}</span>
        <span className="flex shrink-0 items-center gap-2 text-pt-muted">
          {meta}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="border-t border-pt-line px-4 py-3">{children}</div>}
    </div>
  );
}

/** ---------------- Scrollable tabs ---------------- */
export function PTMTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 pb-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "min-h-[40px] whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-colors",
              value === t.value ? "bg-pt-noir text-pt-cream" : "border border-pt-line bg-pt-cream text-pt-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** ---------------- Client avatar ---------------- */
export function PTMAvatar({
  name,
  src,
  size = 44,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pt-beige text-[13px] font-semibold text-pt-ink"
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt={name || "Client"} className="h-full w-full object-cover" loading="lazy" /> : initials}
    </div>
  );
}

/** ---------------- Package balance ---------------- */
export function PTMPackageBalance({
  label = "Package",
  used,
  total,
}: {
  label?: string;
  used: number;
  total: number;
}) {
  const remaining = Math.max(total - used, 0);
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const tone = remaining <= 1 ? "red" : remaining <= 3 ? "amber" : "green";
  return (
    <div className="rounded-2xl border border-pt-line bg-pt-cream p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-pt-ink">{label}</p>
        <PTMBadge tone={tone as any}>{remaining} left</PTMBadge>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-pt-beige">
        <div className="h-full rounded-full bg-pt-gold" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-pt-muted">
        {used} of {total} sessions used
      </p>
    </div>
  );
}

/** ---------------- Appointment summary ---------------- */
export function PTMAppointmentSummary({
  time,
  client,
  trainer,
  location,
  status,
  photoUrl,
  onClick,
}: {
  time: string;
  client: string;
  trainer?: string | null;
  location?: string | null;
  status?: string | null;
  photoUrl?: string | null;
  onClick?: () => void;
}) {
  // Must match STATUS_TONE in PTPrimitives: cancellations are neutral, no-shows are red.
  const tone =
    status === "completed" ? "green"
      : status === "no_show" ? "red"
      : status === "in_progress" ? "gold"
      : "neutral";
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-pt-line bg-pt-cream p-3 text-left"
    >
      <PTMAvatar name={client} src={photoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-semibold text-pt-ink">{client}</p>
          <span className="shrink-0 text-[13px] font-semibold text-pt-ink">{time}</span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-pt-muted">
          {[trainer, location].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      {status && <PTMBadge tone={tone as any}>{status.replace(/_/g, " ")}</PTMBadge>}
    </Comp>
  );
}

/** ---------------- Alert ---------------- */
export function PTMAlert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children?: ReactNode;
}) {
  const map = {
    info: { cls: "border-pt-line bg-pt-beige text-pt-ink", Icon: Info },
    warning: { cls: "border-pt-amber/40 bg-pt-amber/10 text-pt-ink", Icon: AlertTriangle },
    danger: { cls: "border-pt-red/40 bg-pt-red/10 text-pt-ink", Icon: AlertTriangle },
    success: { cls: "border-pt-green/40 bg-pt-green/10 text-pt-ink", Icon: CheckCircle2 },
  } as const;
  const { cls, Icon } = map[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-3", cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 text-[13px]">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-pt-muted">{children}</div>}
      </div>
    </div>
  );
}

/** ---------------- Progress metric card ---------------- */
export function PTMMetricCard({
  label,
  value,
  unit,
  delta,
  invertDelta,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  const good = delta == null ? null : invertDelta ? delta < 0 : delta > 0;
  const Icon = (delta ?? 0) >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-2xl border border-pt-line bg-pt-cream p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-pt-muted">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-pt-ink">{value}</span>
        {unit && <span className="text-[12px] text-pt-muted">{unit}</span>}
      </div>
      {delta != null && (
        <p className={cn("mt-1 flex items-center gap-1 text-[12px] font-semibold", good ? "text-pt-green" : "text-pt-red")}>
          <Icon className="h-3.5 w-3.5" />
          {delta > 0 ? "+" : ""}
          {delta}
          {unit ? ` ${unit}` : ""}
        </p>
      )}
    </div>
  );
}

/** ---------------- Session stage indicator ---------------- */
export type PTMStage = "pre" | "live" | "post";

export function PTMStageIndicator({ stage }: { stage: PTMStage }) {
  const stages: { key: PTMStage; label: string }[] = [
    { key: "pre", label: "Pre" },
    { key: "live", label: "Live" },
    { key: "post", label: "Post" },
  ];
  const activeIdx = stages.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-2">
      {stages.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className={cn("h-1.5 w-full rounded-full", i <= activeIdx ? "bg-pt-gold" : "bg-pt-line")} />
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.1em]",
                i === activeIdx ? "text-pt-ink" : "text-pt-muted"
              )}
            >
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
