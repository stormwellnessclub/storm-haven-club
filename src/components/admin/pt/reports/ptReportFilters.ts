import { PTFinFilters, buildAttributionMap, saleDateOf } from "@/hooks/pt/usePTFinancialReports";

export interface PTFinContext {
  filters: PTFinFilters;
  passById: Record<string, any>;
  attribution: Record<string, string>; // client user_id -> instructor_id (explicit only)
  nameOf: (userId?: string | null) => string;
  trainerNameOf: (instructorId?: string | null) => string;
}

export function buildContext(
  filters: PTFinFilters,
  passes: any[],
  clientTrainers: any[],
  nameOf: (id?: string | null) => string,
  trainerNameOf: (id?: string | null) => string,
): PTFinContext {
  const passById: Record<string, any> = {};
  passes.forEach((p) => { passById[p.id] = p; });
  return { filters, passById, attribution: buildAttributionMap(clientTrainers), nameOf, trainerNameOf };
}

/** Trainer filter: "unattributed" matches clients with no explicit trainer on record. */
export function matchesTrainer(ctx: PTFinContext, userId?: string | null) {
  const t = ctx.filters.trainerId;
  if (t === "all") return true;
  const assigned = userId ? ctx.attribution[userId] : undefined;
  if (t === "unattributed") return !assigned;
  return assigned === t;
}

export function matchesClient(ctx: PTFinContext, userId?: string | null) {
  return ctx.filters.clientId === "all" || ctx.filters.clientId === userId;
}

export function matchesPack(ctx: PTFinContext, packId?: string | null) {
  return ctx.filters.packId === "all" || ctx.filters.packId === packId;
}

export function filterPasses(ctx: PTFinContext, passes: any[], windowOnly = true) {
  const { from, to } = ctx.filters;
  return passes.filter((p) => {
    if (windowOnly) {
      const d = saleDateOf(p);
      if (!d || d < from || d > to) return false;
    }
    return matchesClient(ctx, p.user_id) && matchesPack(ctx, p.pack_id) && matchesTrainer(ctx, p.user_id);
  });
}

export function filterCash(ctx: PTFinContext, cash: any[]) {
  const { paymentMethod, paymentStatus } = ctx.filters;
  return cash.filter((c) => {
    const pass = c.pass_id ? ctx.passById[c.pass_id] : undefined;
    if (!matchesClient(ctx, c.user_id)) return false;
    if (!matchesTrainer(ctx, c.user_id)) return false;
    if (ctx.filters.packId !== "all" && pass?.pack_id !== ctx.filters.packId) return false;
    if (paymentMethod !== "all" && (c.method ?? "") !== paymentMethod) return false;
    if (paymentStatus === "refunded" && c.direction !== "refunded") return false;
    if (paymentStatus === "succeeded" && c.direction !== "collected") return false;
    if (["failed", "past_due", "upcoming"].includes(paymentStatus)) return false;
    return true;
  });
}

export function filterInstallments(ctx: PTFinContext, installments: any[]) {
  return installments.filter((i) => {
    const pass = i.pass_id ? ctx.passById[i.pass_id] : undefined;
    if (!matchesClient(ctx, i.user_id)) return false;
    if (!matchesTrainer(ctx, i.user_id)) return false;
    if (ctx.filters.packId !== "all" && pass?.pack_id !== ctx.filters.packId) return false;
    return true;
  });
}

export const UPCOMING_STATUSES = ["scheduled", "pending", "upcoming", "open"];
export const FAILED_STATUSES = ["failed", "past_due", "retrying", "action_required"];

export const isUpcoming = (i: any) => UPCOMING_STATUSES.includes(String(i.status));
export const isFailed = (i: any) => FAILED_STATUSES.includes(String(i.status));
export const isPaid = (i: any) => String(i.status) === "paid" || Boolean(i.paid_at);
