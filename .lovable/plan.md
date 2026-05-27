## Mallak Makled — phone lookup

She has no phone on file anywhere (non_member_profiles, profiles, or her class_bookings walk-in fields). Her account email is **mallakmak07@gmail.com** — that's the only contact channel we have right now.

Her 11am pilates tomorrow (session `fdca3021…`) was booked 2026-05-25 via a pass, with no walk-in phone captured at booking time either.

**Immediate action options:** email her at mallakmak07@gmail.com to request a callback number, or text her sister (Jenna/Mariam/Yasmeen Makled also in the system — also no phones 🙃). We have no working phone for the Makled family at all.

That's exactly the gap the plan below closes so this doesn't keep happening.

---

## Plan — make phone mandatory in the non-member portal

### A. Block portal usage until phone is on file

In `src/components/portal/PortalLayout.tsx`:
- Read `useNonMemberProfile()` + `useUserProfile()`.
- If `profile.phone` is empty/whitespace, render a non-dismissible blocking screen ("Add a phone number to continue") with a Phone input + Save button that writes to `non_member_profiles.phone` (and mirrors to `profiles.phone`).
- All other portal pages stay mounted only after phone is saved. Skip the block on `/portal/profile` itself so they can also edit it there normally.

### B. Validate phone on the Profile page

In `src/pages/portal/Profile.tsx`:
- Mark Phone as required (asterisk + `required` on Input).
- In `handleSave`, reject empty/invalid phone with a toast; only call `updateProfile` when present.
- Light format check: strip non-digits, require ≥10 digits.

### C. Capture phone at booking time for class passes

In `src/pages/portal/BookClass.tsx` (and `src/pages/portal/Book.tsx` if it has a confirm step):
- Before allowing the booking RPC to fire, check `non_member_profiles.phone`. If missing, show an inline "Add phone to confirm booking" mini-form, save it, then proceed.
- This guarantees every future class booking has a reachable contact, matching the existing **Attendee Resolution** rule ("Phone required for all bookings to prevent 'Unknown' attendees").

### D. Capture phone at signup / first portal load (belt-and-suspenders)

`useNonMemberProfile` already auto-creates a row from `profiles`. No schema change — the gate in A will catch any account where phone never made it in (Google OAuth signups, legacy imports, the Makled accounts, etc.).

### E. Admin visibility

In `src/pages/admin/NonMemberAccounts.tsx`, add a small "No phone" filter chip / badge so staff can proactively sweep the existing pile of phone-less accounts (Mallak, Jenna, Mariam, Yasmeen + others) and request numbers.

---

## Files touched

- `src/components/portal/PortalLayout.tsx` — phone gate
- `src/pages/portal/Profile.tsx` — required validation
- `src/pages/portal/BookClass.tsx` (+ `Book.tsx` if needed) — inline phone capture before booking
- `src/pages/admin/NonMemberAccounts.tsx` — "No phone" filter/badge
- `src/hooks/useNonMemberProfile.ts` — small `hasPhone` helper exported for the gate

No DB migration, no RLS changes, no edge function changes.
