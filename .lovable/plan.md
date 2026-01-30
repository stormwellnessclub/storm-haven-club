

## Updated Plan: Pre-Launch Approval Email Option

### Overview

Adding a new "Approve & Send Pre-Launch Email" option to the admin Applications portal. This email confirms approval without directing applicants to create an account or visit the website during the build phase.

---

### Updated Email Template Content

```html
Subject: Welcome to Storm Wellness Club - Application Approved!

Dear [First Name],

We are delighted to inform you that your application to Storm Wellness Club has been approved.

The way you choose to care for yourself matters. Storm Wellness Club was built for people who value intention, depth, and an environment that supports the whole person—physically, mentally, and through recovery.

We are currently finalizing the last details before our opening. Please keep an eye out in the coming days for more emails from us with instructions on how to create your account and complete your membership setup.

In the meantime, know that your spot is secured as a [Membership Tier] member.

Thank you for your patience as we prepare to welcome you.

Warmly,
Storm
Founder, Storm Wellness Club

---
Storm Wellness Club
```

**Changes from original draft:**
- ~~"choose your start date"~~ → Removed
- ~~"Once we are ready, you will receive another email with instructions..."~~ → "Please keep an eye out in the coming days for more emails from us with instructions on how to create your account and complete your membership setup."

---

### Implementation Summary

| File | Change |
|------|--------|
| `supabase/functions/send-email/index.ts` | Add `application_approved_pre_launch` email type with updated template |
| `src/pages/admin/Applications.tsx` | Add "Approve & Send Pre-Launch Email" dropdown option |

---

### Dropdown Menu After Implementation

```text
📋 View Details
💵 Charge Card (if payment on file)
💳 Add/Update Payment Method
📧 Request Payment Info
---
📤 Approve & Send Email              
🚀 Approve & Send Pre-Launch Email   ← NEW (no links)
📪 Approve (No Email)
⚡ Approve & Auto-Activate
📅 Approve with Locked Start Date
---
❌ Reject
🚫 Cancel
```

---

### What Stays Unchanged

- All existing email types and logic remain intact
- Standard approval flow unchanged
- Member creation logic unchanged
- Payment handling unchanged

