# ✅ PWA Reinstall Instructions Email - IMPLEMENTED

### Summary
Added a new email option that allows admins to send PWA reinstall instructions to members who installed the app from the old `storm-haven-club.lovable.app` domain, guiding them to reinstall from the new `stormwellnessclub.com` domain.

---

### Changes Made

#### 1. Updated Edge Function: `supabase/functions/send-email/index.ts`
- Added `'pwa_reinstall_instructions'` to the EmailRequest type union
- Updated `BASE_URL` fallback from `storm-haven-club.lovable.app` to `stormwellnessclub.com`
- Added new email template with:
  - iOS instructions (Safari → Share → Add to Home Screen)
  - Android instructions (Chrome → Menu → Install app)
  - Reassurance about preserved data
  - CTA button to stormwellnessclub.com

#### 2. Updated Admin UI: `src/pages/admin/Applications.tsx`
- Added `Smartphone` icon import from lucide-react
- Added "Send PWA Reinstall Instructions" menu item in the Resend Email dropdown
- Logs sends to `email_audit_log` for visibility

---

### How to Use

1. Go to **Admin → Applications**
2. Click the **⋮** menu on any approved member
3. Select **"Send PWA Reinstall Instructions"**
4. The member receives the email with step-by-step instructions

The "Email Sent" column will show when this email was sent.

