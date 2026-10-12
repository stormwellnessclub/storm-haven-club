// Lymphatic Body Roller member presale: server-authoritative options + branded campaign emails.
// Keep OPTIONS in sync with src/lib/bodyRollerPresale.ts.

export const PRESALE_OPTIONS: Record<string, {
  price_id: string; audience: "member" | "non_member"; label: string; duration: 30 | 60; sessions: number; cents: number; regular_cents: number;
}> = {
  "30_single": { price_id: "price_1UPeVcLyZrsSqLhs5jEDphcQ", audience: "member", label: "30-Minute Session", duration: 30, sessions: 1, cents: 3500, regular_cents: 4900 },
  "30_5pack": { price_id: "price_1UPeVdLyZrsSqLhs0y2jMqWk", audience: "member", label: "30-Minute 5-Pack", duration: 30, sessions: 5, cents: 15000, regular_cents: 23000 },
  "30_10pack": { price_id: "price_1UPeVeLyZrsSqLhsZdWnmHwV", audience: "member", label: "30-Minute 10-Pack", duration: 30, sessions: 10, cents: 30000, regular_cents: 49000 },
  "60_single": { price_id: "price_1UPeVfLyZrsSqLhsZHYz2KCD", audience: "member", label: "60-Minute Session", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  "60_5pack": { price_id: "price_1UPeVfLyZrsSqLhsBzkZzYCb", audience: "member", label: "60-Minute 5-Pack", duration: 60, sessions: 5, cents: 32500, regular_cents: 45000 },
  "60_10pack": { price_id: "price_1UPeVgLyZrsSqLhsYfd7rLOJ", audience: "member", label: "60-Minute 10-Pack", duration: 60, sessions: 10, cents: 60000, regular_cents: 80000 },
  // Non-member early purchase at regular price (singles only for now).
  "nm_30_single": { price_id: "price_1UPebMLyZrsSqLhsxsaxaBhA", audience: "non_member", label: "30-Minute Session (Non-Member)", duration: 30, sessions: 1, cents: 4900, regular_cents: 4900 },
  "nm_60_single": { price_id: "price_1UPebMLyZrsSqLhs7ucmYTbZ", audience: "non_member", label: "60-Minute Session (Non-Member)", duration: 60, sessions: 1, cents: 9000, regular_cents: 9000 },
};

/** 6% MI tax, then card fee gross-up (total + $0.30) / (1 - 0.029). */
export function presaleTotals(subtotal: number) {
  const tax = Math.round(subtotal * 0.06);
  const base = subtotal + tax;
  const total = Math.round((base + 30) / (1 - 0.029));
  return { subtotal, tax, fee: total - base, total };
}

export const SITE = "https://stormwellnessclub.com";
export const PRESALE_URL = `${SITE}/body-roller-presale`;
const IMG = {
  hero: `${SITE}/__l5e/assets-v1/89a367c4-0e67-4abd-9278-5ef7d9ebaa93/body-roller-Image_9.jpeg`,
  legs: `${SITE}/__l5e/assets-v1/cb89f811-ea21-47a6-a994-0eb072f26068/body-roller-Image_16.jpeg`,
  machine: `${SITE}/__l5e/assets-v1/02d95957-88b3-46b0-be34-9c615f961e69/body-roller-Image_57.jpeg`,
};

export type EmailKind = "launch" | "halfway" | "last_chance" | "arrived";

export const EMAIL_META: Record<EmailKind, { key: string; subject: string }> = {
  launch: { key: "body_roller_presale_launch", subject: "Introducing the Lymphatic Body Roller — Member Presale Now Open" },
  halfway: { key: "body_roller_presale_halfway", subject: "Your member presale pricing on the Body Roller is still open" },
  last_chance: { key: "body_roller_presale_last_chance", subject: "Last days: Body Roller member presale pricing ends soon" },
  arrived: { key: "body_roller_presale_arrived", subject: "The Body Roller has arrived — your sessions are ready to book" },
};

//EMAILS
