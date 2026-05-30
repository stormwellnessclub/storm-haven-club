## Goal

1. Customers can leave a spa review from a shareable link — works whether they're logged in or not.
2. An email goes out automatically after a completed spa appointment with a "Leave a review" button. Admin can also copy/share the link manually.
3. Make sure the admin moderation surface (which already exists) is easy to find, and reviews submitted via the public link land there for hide/delete.

---

## 1. Public spa review page (token-based, no login required)

**New table `spa_review_tokens`**
- `token` (uuid, primary key)
- `appointment_id` (uuid, unique — one token per appointment)
- `service_id`, `therapist_id`, `user_id` (nullable, captured from appointment for context)
- `expires_at` (90 days)
- `used_at` (null until submitted)
- RLS: no direct client access. Only SECURITY DEFINER RPCs read/write it.

**New RPCs**
- `get_spa_review_token_info(_token)` → returns `{ service_name, therapist_name, appointment_date, already_used, expired }`. Public/anon callable.
- `submit_spa_review_via_token(_token, _rating, _review_text)` → validates token, inserts into existing `spa_reviews` table (with `user_id` from token if present, otherwise null), marks token used. Public/anon callable. Returns success/error.

**Schema tweak to `spa_reviews`**: allow `user_id` to be nullable so anonymous (guest, no-account) submissions can land. Admin UI already falls back to "Member" label when reviewer not found — fine.

**New page `/review/spa/:token`** (public, no auth gate)
- Calls `get_spa_review_token_info` on mount.
- Shows service + therapist + date, star picker (StarRating reused), optional text.
- States: invalid token, expired, already submitted ("Thanks!"), submit form, success.
- Reuses existing `ReviewDialog` styling, rendered as a full page.

---

## 2. Token issuance + email + manual share

**Token creation trigger**: Database trigger on `spa_appointments` — when `status` transitions to `completed`, insert a row into `spa_review_tokens` (idempotent on `appointment_id`).

**Auto email** (post-completion)
- New edge function `send-spa-review-request` mirrors existing transactional senders.
- Triggered by a small cron job (every 15 min, like `process-guest-feedback-emails`) that finds `spa_review_tokens` rows where `email_sent_at IS NULL` AND appointment completed ≥ 30 min ago, then sends and stamps `email_sent_at`.
- Email body: matches Storm Wellness Club template (neutral open-club tone, "The Storm Wellness Club Team" signature). Single CTA button → `https://stormwellnessclub.com/review/spa/{token}`.
- Recipient: appointment's email (members table or non_member_profiles); skip if no email on file.

**Manual admin share**
- In `SpaCompletionDialog` and in the appointment row on `SpaManagement`, add a "Copy review link" button (super admin / staff). Calls a small RPC `ensure_spa_review_token(_appointment_id)` that returns the token (creates one if completion already happened pre-trigger). Copies the full URL.

---

## 3. Surface the existing admin moderation

It already lives at **Admin → Spa Management → Reviews tab** (`SpaReviewsAdminTab`). Hide/Unhide for staff, Delete for super admin, filter by service/therapist/visibility.

Improvements so it's discoverable and complete:
- Add a top-level **"Reviews"** link in the admin sidebar under Spa (deep-links to `/admin/spa-management?tab=reviews`).
- In the reviews list, show a small **"via public link"** badge when the review was submitted through a token (we'll set this by storing `source` = `'token' | 'portal'` on `spa_reviews`).
- Anonymous (no `user_id`) reviews display as "Guest" with the appointment's first name + initial when available.
- Confirm Delete is wired (it is) and bump it from super-admin only to admin+ so moderation isn't bottlenecked. *(Confirm with you — keep super-admin only?)*

---

## Technical notes

```text
Completion ──trigger──▶ spa_review_tokens row
                             │
              cron (15m) ────┴──▶ send-spa-review-request email
                                       │
                Customer clicks ───────┴──▶ /review/spa/:token
                                                  │
                          submit_spa_review_via_token RPC
                                                  │
                                            spa_reviews
                                                  │
                                Admin → Spa Mgmt → Reviews (hide/delete)
```

- Reuses existing `spa_reviews`, `LeaveSpaReviewBanner`, `ReviewDialog`, `StarRating`, `SpaReviewsAdminTab`.
- No changes to portal review flow — logged-in members still submit via portal banner.
- One token per appointment, 90-day expiry, single-use.
- All Edge Functions deployed with `verify_jwt = false` for the public RPC endpoints; submission RPC is rate-limit-safe (token can only be used once).

---

## Out of scope

- Public link for class reviews (decided: spa only for now).
- SMS delivery of the link (email only; can add later via existing Twilio infra).
- Admin reply/response under reviews.
- Email notification to staff on each new review.
