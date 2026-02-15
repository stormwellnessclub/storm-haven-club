

## Fix Guest Pass Credit Visibility and Add Notification Email

### Problems

1. **Admin MemberDetail Credits tab hides guest pass credits**: Line 1760 of `MemberDetail.tsx` only iterates over `['class', 'red_light', 'dry_cryo']`, completely excluding `'guest_pass'` from the grid display. The data is fetched but never rendered.

2. **Member Credits page works correctly**: The member-facing `/member/credits` page already shows guest pass credits (lines 66-98 of `Credits.tsx`). However, it depends on `useUserCredits` which queries by `member_id` -- this should be working if credits are properly created.

3. **No email notification when credits are granted**: When an admin grants a guest pass credit (either individually or via the promo tool), there's an existing `guest_pass_promo` email template, but it's only triggered from the bulk promo tool in `GuestPassMarketingTab`. Individual credit grants from the MemberDetail page or MemberCredits page don't send any notification.

### Changes

**1. Show guest pass credits in admin MemberDetail Credits tab**

In `src/pages/admin/MemberDetail.tsx` line 1760, add `'guest_pass'` to the credit types array:

```typescript
// Change from:
(['class', 'red_light', 'dry_cryo'] as CreditType[]).map(...)

// Change to:
(['class', 'red_light', 'dry_cryo', 'guest_pass'] as CreditType[]).map(...)
```

Also update the grid from `md:grid-cols-3` to `md:grid-cols-4` (line 1759) to accommodate the 4th credit card.

**2. Add a `guest_pass_credit_granted` email template**

Add a new email type to `supabase/functions/send-email/index.ts` that is purpose-built for when a member receives a guest pass credit (as opposed to the promo which is a bulk marketing blast). This template will:

- Inform the member they have a complimentary guest pass credit
- Show how many credits they have
- Include a direct link to `/member/credits` to register their guest
- Include expiry information

**3. Trigger the email when credits are granted from admin**

In `src/pages/admin/MemberDetail.tsx`, after the guest pass credit is successfully created/adjusted (around line 418), call the `send-email` edge function with the new template to notify the member.

Similarly, in `src/pages/admin/MemberCredits.tsx` (line 224 area), add the same notification call after granting credits.

### Technical Details

| File | Change |
|------|--------|
| `src/pages/admin/MemberDetail.tsx` | Add `'guest_pass'` to credit types array on line 1760; change grid to 4 columns on line 1759; add email notification after credit grant around line 418 |
| `src/pages/admin/MemberCredits.tsx` | Add email notification after credit grant around line 224 |
| `supabase/functions/send-email/index.ts` | Add `'guest_pass_credit_granted'` email type and branded template |

**New email template: `guest_pass_credit_granted`**

```text
Subject: "You Have a Complimentary Guest Pass!"
Data: { name, credits_count, expires_date }

Content:
- Greeting with member name
- "You've received [X] complimentary guest pass credit(s)"
- Info box with credit count and expiry
- Instruction to register guest via member portal
- CTA button: "Register Your Guest" -> /member/credits
- Signed by The Storm Wellness Club Team
```

**Email trigger logic (added to credit grant handlers):**

```typescript
// After successful credit insert/update
if (member.email && member.user_id) {
  await supabase.functions.invoke("send-email", {
    body: {
      type: "guest_pass_credit_granted",
      to: member.email,
      data: {
        name: member.first_name,
        credits_count: adjustment,
        expires_date: format(expiresAt, "MMMM d, yyyy"),
      },
    },
  });
}
```
