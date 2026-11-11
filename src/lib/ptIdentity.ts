/**
 * Canonical PT identity: one person = one user_id. Membership and PT are
 * separate relationships. An old non_member_profiles row never outranks a
 * current membership; a cancelled membership makes the person a Former member.
 */
export type PTRelationship = "Member" | "Non-member" | "Former member";

export function relationshipFromMemberRows(rows: { status?: string | null }[] | undefined): PTRelationship {
  const list = rows ?? [];
  if (list.some((r) => r.status && r.status !== "cancelled")) return "Member";
  if (list.some((r) => r.status === "cancelled")) return "Former member";
  return "Non-member";
}

/** Group members rows by user_id and resolve each person's current relationship. */
export function relationshipMap(members: { user_id: string | null; status?: string | null }[]): Record<string, PTRelationship> {
  const byUser: Record<string, { status?: string | null }[]> = {};
  members.forEach((m) => {
    if (!m.user_id) return;
    (byUser[m.user_id] ??= []).push(m);
  });
  const out: Record<string, PTRelationship> = {};
  Object.entries(byUser).forEach(([id, rows]) => { out[id] = relationshipFromMemberRows(rows); });
  return out;
}

/** Non-member PT packs are named "Non-Member …". */
export function isNonMemberPackName(name: string | null | undefined): boolean {
  return /^non[-\s]?member/i.test((name ?? "").trim());
}

/**
 * Default single-session PT rate for a person. Current members get the member
 * single-session price; non-members and former (cancelled) members get the
 * "Non-Member" single-session price when one exists for that format.
 */
export function singleSessionRateCents(
  packs: { format: string; price_cents: number; name?: string | null }[],
  format: string,
  relationship: PTRelationship,
): number {
  const forFormat = packs
    .filter((p) => p.format === format && p.price_cents > 0)
    .sort((a, b) => a.price_cents - b.price_cents);
  const memberRate = forFormat.find((p) => !isNonMemberPackName(p.name));
  const nonMemberRate = forFormat.find((p) => isNonMemberPackName(p.name));
  if (relationship !== "Member" && nonMemberRate) return nonMemberRate.price_cents;
  return (memberRate ?? nonMemberRate)?.price_cents ?? 0;
}
