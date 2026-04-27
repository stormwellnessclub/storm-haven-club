# Freeze Rejection Emails — Scoped & Premium Tone

## Scope clarification (per your direction)

- The **freeze rejection email** speaks **only to the freeze decision** — never about rescinding/cancelling the membership.
- **Rescinding Brea's membership approval** is a **separate action** handled through the existing **Cancel Membership** flow on her Member Detail page, which already auto-sends the correct `application_cancelled` email. No new code needed for that — I'll just make sure you know exactly where to click.
- **Mariam's rejection email** includes the firm **May 9, 2026 deadline** and the **collections** consequence per her one-year membership agreement.

---

## 1. New email template: `freeze_request_rejected`

**File:** `supabase/functions/send-email/index.ts`

Add a new template type that accepts an admin-edited subject and body, wraps the body in the standard branded layout (logo, footer, signature: *The Storm Wellness Club Team*), and sends. The body is rendered with paragraph breaks preserved — the admin types in plain text, the function escapes + wraps it in branded HTML.

Payload shape:
```ts
{
  type: 'freeze_request_rejected',
  to: string,
  subject: string,        // admin-editable
  bodyText: string,       // admin-editable, plain text with line breaks
  memberFirstName: string
}
```

---

## 2. Two preset templates (admin can edit before sending)

### Preset A — "Membership Not Yet Active" (Brea's case)
**Subject:** `Regarding Your Freeze Request`

**Body (pre-filled, editable):**
> Hi Brea,
>
> Thank you for reaching out. After reviewing your account, we are unable to approve your freeze request at this time.
>
> A membership freeze is a benefit reserved for members whose dues are active and current. Our records show that while your initiation fee was processed, your monthly dues have not yet been collected, meaning your membership has not been formally activated.
>
> Because there is no active billing to pause, a freeze is not applicable to your account in its current state.
>
> If you would like to discuss the status of your membership directly, please reach out to us.
>
> The Storm Wellness Club Team

> **Note:** This email intentionally says nothing about rescission. After sending it, you'll separately go to Brea's **Member Detail → Cancel Membership** to rescind the approval — that triggers its own dedicated email automatically.

### Preset B — "Membership in Arrears" (Mariam's case)
**Subject:** `Regarding Your Freeze Request`

**Body (pre-filled, editable):**
> Hi Mariam,
>
> Thank you for reaching out. After reviewing your account, we are unable to approve your freeze request at this time.
>
> A membership freeze is a courtesy extended to members in good standing. Our records show that your monthly dues have been declined for the past two billing cycles, leaving a significant balance outstanding on your account.
>
> Per the terms of your one-year membership agreement, you have until **May 9, 2026** to bring all outstanding dues current. If the balance is not settled in full by that date, your account will be referred to collections in accordance with the agreement you signed at enrollment.
>
> Once your account is current and in good standing, we would be glad to revisit a freeze request.
>
> If you'd like to settle your balance or discuss a path forward, please reach out to us directly.
>
> The Storm Wellness Club Team

### Preset C — "Custom"
Blank subject and body for any other case.

---

## 3. Admin UI changes

**File:** `src/pages/admin/FreezeRequests.tsx`

In the existing **Reject** dialog, replace the single "Reason" textarea with:

1. **Scenario picker** (dropdown): `Membership Not Yet Active` · `Membership in Arrears` · `Custom`
2. **Subject** input — pre-filled by scenario, editable
3. **Message Body** textarea (10+ rows) — pre-filled by scenario, editable, the member's first name auto-injected on scenario change
4. **Internal rejection reason** — short input, stored on the freeze record only (not emailed)
5. **"Send rejection email to member"** checkbox (default: ✅ checked)

Switching scenarios swaps the subject + body to that preset (with a confirm if the admin has already typed custom edits).

---

## 4. Logic update

**File:** `src/hooks/useAdminFreezeRequests.ts`

Update `useRejectFreezeRequest` to:
1. Update the freeze record with `status: 'rejected'`, `reviewed_by`, `reviewed_at`, and the **internal** `rejection_reason`
2. If "Send email" is checked, invoke `send-email` with `type: 'freeze_request_rejected'` plus the admin's edited subject + body
3. Toast: `"Freeze rejected — email sent to {member name}"`

---

## 5. Brea's rescission (no new code)

After you send Brea's freeze rejection, on her Member Detail page click **Cancel Membership**. That flow already exists and auto-detects her state as "never paid dues" → sends the `application_cancelled` email. I'll just add a small inline note on the **rejected** freeze card linking directly to her Member Detail to make the two-step workflow obvious.

---

## Files to be edited
- `supabase/functions/send-email/index.ts` — add `freeze_request_rejected` template
- `src/hooks/useAdminFreezeRequests.ts` — wire email send into rejection
- `src/pages/admin/FreezeRequests.tsx` — scenario picker + editable subject/body + "Open member profile to rescind" link on rejected cards

## What does NOT change
- The existing freeze approval / activation / early-end flows
- The existing membership cancellation flow (already perfect for Brea's rescission)
- The QR scanner frozen-member changes shipped earlier
