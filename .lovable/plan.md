

## Require Accounts for All Purchases — Unified Customer Tracking

### What's Happening Now

Your **in-app purchase pages** (Class Passes, Guest Pass) already require an account before checkout — that part is working correctly. The problem is **Stripe Payment Links** — the links you share via text, Instagram, email, etc. When someone clicks those and pays through Stripe directly, they never create an account in your system, so:

- You can't see what they bought in your admin tools
- They have no waiver on file
- They can't track their own passes or bookings
- You can't contact them through the system

### The Fix

Instead of trying to block Stripe Payment Links (which are useful for marketing), we'll close the loop from both sides:

**1. Auto-create accounts for Payment Link buyers (backend)**
When someone buys through a Payment Link and has no account, the webhook will automatically create a `non_member_profiles` record using their Stripe email. This means every buyer — regardless of how they paid — shows up in your Non-Member Accounts admin page.

**2. Send a "Complete Your Account" email after purchase (backend)**
After creating their profile, the system sends a branded email inviting them to set a password and finish their profile. This gets them into the portal where they can sign waivers, see their passes, and book classes.

**3. Add a "People" search across all account types (admin)**
Add a unified search in your admin panel that queries both `members` and `non_member_profiles` so you can find anyone who has ever purchased a service — whether they're a member, non-member, or guest pass buyer.

### Technical Details

**File: `supabase/functions/stripe-webhook/index.ts`**
- In the Payment Link fallback handler (the code we just added), when no matching user is found by email:
  - Use `supabase.auth.admin.createUser()` with the Stripe customer email to create an auth account (with a random password and `email_confirm: true`)
  - Insert a `non_member_profiles` record linked to the new user
  - Create the `class_passes` or credit record linked to this new user
  - Trigger a `payment_link_welcome` email via the `send-email` edge function with a password reset link so they can set their own password

**File: `supabase/functions/send-email/index.ts`**
- Add a `payment_link_welcome` email template that includes:
  - Confirmation of what they purchased
  - A "Set Your Password" button linking to the password reset flow
  - Brief explanation of the portal benefits (track passes, sign waivers, book classes)

**File: `src/pages/admin/Members.tsx` or new unified search**
- Add a search component that queries both `members` and `non_member_profiles` tables
- Display results with a badge indicating account type (Member / Non-Member / Guest)
- Link to the appropriate detail view

**Database: No schema changes needed**
- `non_member_profiles` already has all the fields needed (email, name, stripe_customer_id, waiver_signed)
- `class_passes` already supports `user_id` linking

### What This Achieves

- Every person who pays you — through the app or a Payment Link — gets an account automatically
- You can find and manage all customers from one place in admin
- Buyers get an email to finish setting up their account, sign waivers, and use the portal
- No changes to your existing in-app checkout flows (they already work correctly)
