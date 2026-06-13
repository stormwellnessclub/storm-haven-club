# Fix: SMS Opt-In Gate Is Confusing When Phone Is Missing

## Problem
Users hitting `SmsOptInGate` / `NonMemberSmsOptInGate` with no phone on file see a bare interstitial whose only action is a small "Add phone number to continue" link. It's unclear what they're being asked, why they're stuck, and what to do. Many of these users almost certainly have a phone number elsewhere in our records (membership application, non-member profile, Stripe customer) — it just isn't on the row the gate is reading.

## Fix — two parts

### 1. Make the "missing phone" state self-service and obvious
Rewrite the gate UI so when no phone is on file it becomes a clear, in-place fix instead of a redirect:

- Headline changes to **"We need your mobile number"** with a one-sentence explanation: *"We send class reminders, waitlist alerts, and appointment confirmations by text. Add your number to continue."*
- Show a labeled phone input directly inside the dialog (auto-formatted `(555) 555-5555`, `tel` keyboard on mobile).
- Primary button **"Save & Enable SMS"** — disabled until 10+ digits entered. On click:
  1. Update `phone` + `sms_opt_in=true` + `sms_opt_in_at` + `sms_opt_in_source='portal_gate'` on the right table (`profiles` for members, `non_member_profiles` for non-members).
  2. Insert `opt_in` row in `sms_consent_log` (same shape it already uses).
  3. Invalidate the profile query so the gate closes.
- Keep the existing SMS disclosure text below the input (already required for A2P compliance).
- The "Add phone number to continue" redirect link goes away — no more bounce to /member/profile or /portal/profile.

If a phone IS already on file, the gate behaves as it does today (single "Enable SMS Alerts" button), just with a clearer headline/subhead.

### 2. Pre-fill the phone field from any record we have
Before showing the empty input, look up a fallback phone in this order and pre-populate (user can edit before saving):

- Members: `profiles.phone` → `members.phone` (matched by email) → `membership_applications.phone` (latest by email).
- Non-members: `non_member_profiles.phone` → `pending_non_member_imports.phone` (matched by email) → `members.phone` (matched by email).

This is what the user means by "you probably just don't have it linked" — the number often exists, we're just not reading it. Pre-filling means most users tap one button instead of typing.

## Files to change
- `src/components/member/SmsOptInGate.tsx` — new headline/subhead, inline phone input + save handler, fallback phone lookup.
- `src/components/portal/NonMemberSmsOptInGate.tsx` — same treatment against `non_member_profiles` with its own fallback chain.
- (Optional, small) `src/hooks/useUserProfile.ts` / `src/hooks/useNonMemberProfile.ts` — only if a tiny helper is needed to expose the fallback lookup; otherwise do it inline in the gate with a one-shot Supabase query.

## Out of scope
- No schema changes — all columns already exist.
- Not adding a "No thanks / decline" path (separate concern; user explicitly said this isn't about decline).
- Not changing how/when the gate triggers — only what the user sees and can do inside it.
