

## PWA Reinstall Instructions Email - Implementation Plan

### Summary
Add a new email option that allows admins to send PWA reinstall instructions to members who installed the app from the old `storm-haven-club.lovable.app` domain, guiding them to reinstall from the new `stormwellnessclub.com` domain.

---

### Changes Overview

#### 1. Update Edge Function: `supabase/functions/send-email/index.ts`

**Add to EmailRequest type (line 10):**
- Add `'pwa_reinstall_instructions'` to the union type

**Add new email template case:**
```
Subject: Important: Update Your Storm App
```

The email will include:
- Explanation that the domain has changed
- Instructions for iOS users (delete old app, open Safari, tap Share → Add to Home Screen)
- Instructions for Android users (delete old app, open Chrome, tap menu → Install app)
- Call-to-action button linking to `stormwellnessclub.com`
- Reassurance that all account data and preferences are preserved

#### 2. Update Admin UI: `src/pages/admin/Applications.tsx`

**Add new dropdown menu item** in the "Resend Email" section (after line 2293):
- Icon: `Smartphone` from lucide-react
- Label: "Send PWA Reinstall Instructions"
- Behavior: Sends the `pwa_reinstall_instructions` email and logs to `email_audit_log`

---

### Technical Details

#### Email Template Content
```text
Subject: Important: Update Your Storm App

Dear [Name],

We've moved to our official domain! To ensure the best experience, 
please reinstall the Storm Wellness Club app.

📱 For iPhone/iPad:
1. Delete the old "Storm" app from your home screen
2. Open Safari and visit stormwellnessclub.com
3. Tap the Share button (□↑)
4. Tap "Add to Home Screen"

📱 For Android:
1. Delete the old "Storm" app
2. Open Chrome and visit stormwellnessclub.com
3. Tap the menu (⋮) → "Install app"

Your account, preferences, and membership are fully preserved.

[Visit stormwellnessclub.com button]

Questions? Contact us at support.
```

#### BASE_URL Update
The edge function currently uses:
```typescript
const BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://storm-haven-club.lovable.app';
```

The implementation will update the fallback to `'https://stormwellnessclub.com'` to ensure all emails use the correct domain.

#### Files to Modify
| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Add email type, template, and update BASE_URL fallback |
| `src/pages/admin/Applications.tsx` | Add "Send PWA Reinstall Instructions" menu item |

---

### Sequence of Operations

```text
+------------------+     +-------------------+     +------------------+
|  Admin clicks    | --> |  Invoke send-email| --> |  Email delivered |
|  "Send PWA       |     |  edge function    |     |  to member       |
|  Reinstall"      |     |                   |     |                  |
+------------------+     +-------------------+     +------------------+
                                |
                                v
                         +-------------------+
                         |  Log to           |
                         |  email_audit_log  |
                         +-------------------+
```

---

### After Implementation

Once approved, the admin can:
1. Go to **Admin → Applications**
2. Click the **⋮** menu on any approved member
3. Select **"Send PWA Reinstall Instructions"**
4. The member receives the email with step-by-step instructions

The email audit log will track these sends for visibility in the "Email Sent" column.

