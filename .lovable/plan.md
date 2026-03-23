

## Update Member Activation Email Template

### Changes

**File: `supabase/functions/send-email/index.ts`** (lines 1205-1295)

1. **Subject line** → `Welcome to Storm Wellness Club — Complete Your Membership Setup`
2. **Opening paragraph** → Remove launch date reference. Replace with:
   > "Welcome to Storm Wellness Club! Complete these steps to activate your member portal and unlock full member access."
3. **Remove** the `launchDate` variable and all references to it
4. **Remove** the "One-Time Courtesy" founding member tier change block (lines 1254-1262)
5. **Remove** the "Please complete these steps before [date]" deadline block (lines 1264-1271) — replace with a simple note:
   > "Complete these steps to activate your member portal for full member access."
6. **Keep as-is**: email address callout box, setup steps list, payment method tip, CTA button, direct links, sign-off
7. **Closing line** → "We're excited to have you at Storm Wellness Club." (remove "welcoming you" phrasing that implies they haven't joined yet)

