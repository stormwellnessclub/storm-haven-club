## Goal

Drive SMS opt-in from ~3% (23/721) to near-universal by surfacing it everywhere a member touches the product, with a hard interstitial gate inside the portal that has no "dismiss" — only "Enable SMS Alerts."

## 1. Signup (Apply form) — pre-checked

File: `src/pages/Apply.tsx`

- Flip `SmsConsentCheckbox` to default `checked={true}` when the form mounts (current state defaults to false).
- Move the checkbox out of the fine-print zone into its own bordered card directly above the submit button, with a short value prop:
  > "📱 Get class reminders, waitlist alerts, and billing notifications by text. Standard rates apply. Reply STOP to opt out."
- Persist `sms_opt_in = true`, `sms_opt_in_at`, `sms_opt_in_source = "apply_form"` to `profiles` on application submit (already wired — just confirm the pre-checked value flows through).

## 2. Public homepage (/) — phone capture widget

File: `src/pages/Index.tsx` (a new small section, placed after the Recovery section, before Philosophy to match `mem://style/homepage/layout-order`).

New component: `src/components/home/SmsSignupSection.tsx`
- Headline: "Never miss a class drop."
- Single phone input + "Text me alerts" button.
- On submit → call existing `send-sms` edge function once with a welcome confirmation, then insert into a new lightweight `sms_marketing_leads` table (email optional, phone required, source = "homepage"). Marks `consent_given = true` with disclosure version + timestamp.
- Compliance copy underneath matches `SMS_DISCLOSURE_TEXT` (already in `SmsConsentCheckbox.tsx`).

Migration: create `public.sms_marketing_leads (id, phone, email, source, consent_given, consent_version, consent_at, user_agent, created_at)` with RLS allowing `anon` INSERT only, admin/service_role full access. Grants per project rules.

## 3. Member portal — hard interstitial gate

Replace the dismissible banner with a forcing modal.

New component: `src/components/member/SmsOptInGate.tsx`
- Renders a non-dismissible `<Dialog>` (no `X`, `onOpenChange` no-op, no overlay click-to-close) inside `MemberLayout` whenever the logged-in `profile.sms_opt_in !== true`.
- Single primary CTA: **"Enable SMS Alerts"** (per user request, no decline option). 
- Sub-text explains why: "We use SMS for class reminders, waitlist promotions, billing notices, and time-sensitive updates. You can reply STOP at any time to unsubscribe."
- If `profile.phone` is missing → CTA changes to "Add phone number" linking to `/member/profile`.
- On confirm → writes `sms_opt_in=true`, logs to `sms_consent_log` with `source='portal_gate'`, invalidates `user-profile`, dismisses.

Wiring:
- `src/components/member/MemberLayout.tsx`: remove the existing SMS banner item from the notification bar (lines around 92–96), mount `<SmsOptInGate />` instead at layout root.
- Same gate applies to the non-member portal layout (`/portal`), reading `non_member_profiles.sms_opt_in`.

Edge cases:
- Members with `sms_opt_out_at` set within the last 30 days → suppress the gate (respect explicit opt-out so we don't harass them; admins can see opt-out status).
- Admin/staff impersonation → suppress gate.

## 4. Admin visibility

File: `src/pages/admin/Members.tsx` (or wherever the member list lives) — add a small "SMS" column / badge showing opt-in status so staff can ask members in person.

(Skip if it slows things down; not blocking.)

## Technical notes

- New table `sms_marketing_leads` is the only schema change; everything else reads existing `profiles.sms_opt_in*` columns and `sms_consent_log`.
- Gate uses `useUserProfile` hook — already in context throughout the portal.
- All writes log to `sms_consent_log` for A2P 10DLC compliance (per `mem://compliance/sms-consent-system`).
- No changes to `send-sms` edge function or any transactional flows; this is purely opt-in capture.

## Out of scope

- Removing existing opt-outs (we respect their choice).
- Bulk re-prompting the 698 non-opted members via email — separate campaign decision.
