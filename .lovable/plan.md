
## Add Soft Launch Hours Banner and Email Template

### What This Does

1. **Member Portal Banner**: A prominent, branded banner visible at the top of every member portal page showing the soft launch hours (Feb 16-22). It will auto-hide after Feb 22.
2. **Email Template**: A new `soft_launch_hours` email type that can be sent to members with the same hours information, styled in the existing Storm brand.

### Hours to Display

| Day | Hours |
|-----|-------|
| Monday - Thursday | 7:00 AM - 10:00 PM |
| Friday | 7:00 AM - 8:00 PM |
| Saturday - Sunday | 7:00 AM - 6:00 PM |

**Period**: February 16 - February 22, 2025

### Changes

**1. New component: `SoftLaunchHoursBanner.tsx`**

A dismissible banner placed in `MemberLayout.tsx` (above the waiver notice area). Features:

- Gold/amber info box matching the brand style
- Clock icon with "Soft Launch Hours" heading
- Clear table of hours by day
- "Feb 16 - Feb 22" date range prominently shown
- Auto-hides after Feb 22 (date check in code)
- Dismissible via an X button (persists in localStorage so it stays hidden for that session)

**2. Update `MemberLayout.tsx`**

Add the `<SoftLaunchHoursBanner />` component at the top of the layout, before existing notices.

**3. New email template: `soft_launch_hours`**

Add to `send-email/index.ts`:

- Subject: "Soft Launch Hours - Storm Wellness Club"
- Branded layout with the hours table
- Welcome message explaining these are temporary opening week hours
- Note that regular hours resume after Feb 22
- Data params: `{ name }` (member first name)

**4. Update `Footer.tsx` hours (optional)**

The footer currently shows regular hours. The soft launch banner will clarify the temporary change, so the footer stays as-is to show what regular hours will be.

### Technical Details

| File | Change |
|------|--------|
| `src/components/member/SoftLaunchHoursBanner.tsx` | New component -- branded hours banner with auto-expiry and dismiss |
| `src/components/member/MemberLayout.tsx` | Add `<SoftLaunchHoursBanner />` above existing notices |
| `supabase/functions/send-email/index.ts` | Add `'soft_launch_hours'` email type and branded HTML template |

**Banner auto-hide logic:**

```typescript
const SOFT_LAUNCH_END = new Date('2025-02-23T00:00:00');
const isActive = new Date() < SOFT_LAUNCH_END;
```

**Email template data:**

```typescript
// Invoke from admin or bulk send
await supabase.functions.invoke("send-email", {
  body: {
    type: "soft_launch_hours",
    to: member.email,
    data: { name: member.first_name },
  },
});
```
