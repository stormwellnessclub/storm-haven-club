/** Round 2 sign-ups close 11:59:59 PM Detroit time, Sunday Nov 15, 2026 (EST, UTC-5). Mirrored in hss_enforce_signup_close. */
export const SOCIETY_SIGNUP_CLOSES_AT = new Date("2026-11-16T04:59:59Z");
export const societySignupsClosed = (now: Date = new Date()) => now > SOCIETY_SIGNUP_CLOSES_AT;
