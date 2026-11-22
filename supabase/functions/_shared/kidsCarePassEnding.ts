// Decides who gets the one-time "your Kids Care pass has ended" notice.
// Kids Care passes are one-time purchases that never renew, so families are told
// once when their pass runs out (date) or is used up, unless they already have
// another usable pass. Child profiles are never touched.

export type KidsCarePassRow = {
  id: string;
  user_id: string | null;
  classes_remaining: number | null;
  expires_at: string;
  status: string | null;
};

export type KidsCareEndNotice = {
  userId: string;
  passIds: string[];
  reason: "expired" | "used_up";
  endedAt: string;
};

/** Only passes that ended within this many days are notified (no old-history blasts). */
export const KIDS_CARE_NOTICE_LOOKBACK_DAYS = 3;

export function isUsablePass(p: KidsCarePassRow, now: Date): boolean {
  return (p.status ?? "active") === "active" && new Date(p.expires_at) > now && (p.classes_remaining ?? 0) > 0;
}

export function kidsCareEndReason(p: KidsCarePassRow, now: Date): "expired" | "used_up" | null {
  if (p.status === "refunded" || p.status === "cancelled") return null;
  const expires = new Date(p.expires_at);
  const lookback = new Date(now.getTime() - KIDS_CARE_NOTICE_LOOKBACK_DAYS * 86_400_000);
  if (expires <= now) return expires >= lookback ? "expired" : null;
  return (p.classes_remaining ?? 0) <= 0 ? "used_up" : null;
}

export function pickKidsCareEndNotices(
  passes: KidsCarePassRow[],
  alreadyNotified: Set<string>,
  now: Date,
): KidsCareEndNotice[] {
  const byUser = new Map<string, KidsCarePassRow[]>();
  for (const p of passes) {
    if (!p.user_id) continue;
    byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);
  }
  const out: KidsCareEndNotice[] = [];
  for (const [userId, rows] of byUser) {
    if (rows.some((p) => isUsablePass(p, now))) continue;
    const ended = rows
      .map((p) => ({ p, reason: kidsCareEndReason(p, now) }))
      .filter((x): x is { p: KidsCarePassRow; reason: "expired" | "used_up" } => x.reason !== null && !alreadyNotified.has(x.p.id));
    if (ended.length === 0) continue;
    ended.sort((a, b) => new Date(b.p.expires_at).getTime() - new Date(a.p.expires_at).getTime());
    const latest = ended[0];
    out.push({
      userId,
      passIds: ended.map((x) => x.p.id),
      reason: latest.reason,
      endedAt: latest.reason === "expired" ? latest.p.expires_at : now.toISOString(),
    });
  }
  return out;
}
