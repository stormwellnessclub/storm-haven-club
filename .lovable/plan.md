
## Add Membership Cancellation Email

Create a branded cancellation confirmation email and add trigger buttons in both the Applications page and Member Detail admin page.

---

### 1. New Email Template in Edge Function

Add a `membership_cancelled` type to the `send-email` edge function. The email will follow the existing luxury brand styling and include:

- "Membership Cancellation Confirmation" subject line
- Personalized greeting with member name
- Confirmation that the membership has been cancelled
- Effective date of cancellation
- Note about any remaining access period (if applicable)
- Invitation to contact the club or reapply in the future
- "Warmly, Storm Wellness Club" sign-off
- Standard branded footer (no portal links since they're no longer a member)

Data parameters: `name`, `membershipTier`, `cancellationDate`, `reason` (optional)

### 2. Auto-Trigger on Application Cancellation

In `src/pages/admin/Applications.tsx`, when an application status is changed to `cancelled`, automatically send the `membership_cancelled` email (similar to how `application_rejected` already sends a rejection email). This covers both individual and bulk cancellations.

### 3. Trigger Button on Member Detail Page

In `src/pages/admin/MemberDetail.tsx`, add a "Send Cancellation Email" action button that appears when a member's status is `cancelled`. This lets admins send the notification after manually changing a member's status, or re-send it if needed.

---

### Technical Details

| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Add `membership_cancelled` to the `EmailRequest` type union. Add new `case 'membership_cancelled'` with branded HTML template using existing `emailStyles`, `getEmailHeader()`, and receipt footer. |
| `src/pages/admin/Applications.tsx` | In the `updateStatusMutation` success handler, when `status === "cancelled"`, invoke `send-email` with type `membership_cancelled` (mirroring the rejection email pattern). |
| `src/pages/admin/MemberDetail.tsx` | Add a "Send Cancellation Notice" button (visible when member status is `cancelled`) that triggers the `membership_cancelled` email with the member's details. |
