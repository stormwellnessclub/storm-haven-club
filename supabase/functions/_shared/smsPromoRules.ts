// Promo text rules that lower carrier filtering (Twilio 30007). Pure functions; shared by
// campaign-studio and tests. Transactional texts (bookings, reminders, receipts) never use these.
export const PROMO_SMS_PER_HOUR = 300;

export function countLinks(text: string): number {
  return (String(text ?? "").match(/https?:\/\/[^\s<>]+|www\.[^\s<>]+|\b[a-z0-9-]+\.(?:com|net|org|co|ly|io|app)\b(?:\/[^\s<>]*)?/gi) ?? []).length;
}

/** Blocking problems: a promo text with more than one link cannot be saved for sending. */
export function smsBlockingIssues(text: string): string[] {
  const n = countLinks(text);
  return n > 1 ? [`Texts: use one link only (this one has ${n}). Carriers often block texts with several links.`] : [];
}

/** Warnings shown before sending; they don't block. */
export function smsWordingWarnings(text: string): string[] {
  const t = String(text ?? "");
  const out: string[] = [];
  if ((t.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => w !== "STOP").length >= 2) out.push("Texts: avoid words in ALL CAPS.");
  if ((t.match(/\$\d/g) ?? []).length > 2) out.push("Texts: more than two prices; carriers often filter price-heavy texts.");
  if (/\b(limited time|act now|hurry|last chance|don't miss|click here|100%|guarantee)/i.test(t)) out.push("Texts: phrases like \"act now\" or \"last chance\" are often filtered.");
  if (t.length > 320) out.push("Texts: over 320 characters; shorter texts are filtered less.");
  return out;
}

/** Wait between promo texts so a big send spreads out over hours. */
export const PROMO_SMS_GAP_MS = Math.ceil(3_600_000 / PROMO_SMS_PER_HOUR);
