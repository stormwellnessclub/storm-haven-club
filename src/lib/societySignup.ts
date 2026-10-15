/** Higher Self Society sign-ups close at 11:59:59 PM Detroit time, Sunday Oct 18, 2026 (EDT, UTC-4). */
export const SOCIETY_SIGNUP_CLOSES_AT = new Date("2026-10-19T03:59:59Z");
export const societySignupsClosed = (now: Date = new Date()) => now > SOCIETY_SIGNUP_CLOSES_AT;
