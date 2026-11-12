// Pure rules for spa late-cancel / no-show charges (shared by the function and its tests).
export const STAFF_ROLES = ["super_admin", "admin", "manager", "spa_staff", "front_desk"];

/** Card charges add the club's processing fee: (amount + $0.30) / (1 - 0.029). */
export function processingFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.ceil((amountCents + 30) / 0.971) - amountCents;
}

/** Clients may only trigger the late-cancel charge for their own appointment; staff may charge any owed item. */
export function canCharge(charge: { user_id: string | null; kind: string }, callerId: string, isStaff: boolean): boolean {
  if (isStaff) return true;
  return charge.kind === "late_cancel" && charge.user_id === callerId;
}

export function chargeLabel(kind: string, serviceName: string, when: string): string {
  return `Spa Aella: ${serviceName} ${kind === "late_cancel" ? "late cancellation" : "missed appointment"} — ${when}`;
}
