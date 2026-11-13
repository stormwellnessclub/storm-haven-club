/** Member spa discount by tier, shown under "Good to know" on the Spa page. */
export const SPA_GOOD_TO_KNOW_TIERS = [
  { tier: "Silver", discount: "5% off" },
  { tier: "Gold", discount: "8% off" },
  { tier: "Platinum", discount: "10% off" },
  { tier: "Diamond", discount: "12% off" },
] as const;

/** Spa page section for each menu category (matches the chapters on the page). */
const CHAPTER_IDS: Record<string, string> = {
  Massage: "massage",
  Facials: "facials-intro",
  "Body Wraps": "body",
  "Body Rituals": "body",
  "Aella Body Lab": "body-lab",
  Recovery: "recovery",
  All: "need",
};

/** Which section of the Spa page a ?category= link opens. */
export function chapterForCategory(category: string): string | null {
  return CHAPTER_IDS[category] ?? null;
}
