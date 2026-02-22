

## Improvements to the Activation Email and Signup Flow

### Problems Found

1. **Impersonal email** -- The activation email says "Thank you for your recent purchase" but never addresses the person by name, even though we store their first and last name in `pending_non_member_imports`.

2. **Profile data not transferred** -- When someone signs up and the trigger creates their class pass, it does NOT copy the `first_name`, `last_name`, or `phone` from the pending import into their `non_member_profiles` row. So their portal profile will be blank except for email.

3. **No visual issues** -- The email template itself is well-branded (Storm logo, gold accents, clear CTA). The link correctly points to `/auth?redirect=/portal`, and the redirect logic is safe and tested.

### What the Email Currently Looks Like

- **Subject**: "Access Your Class Passes -- Storm Wellness Club"
- **Header**: Storm Wellness Club logo with gold gradient bar
- **Body**: Generic message thanking them for their purchase, with a warning to use the same email address
- **Button**: "Create Your Account" linking to the sign-up page
- **Bullet list**: What they can do once signed up (view passes, book classes, track history)
- **Footer**: Standard Storm Wellness Club footer

### Where It Takes Them

The button links to `/auth?redirect=/portal`. After creating their account:
1. They land on the **Non-Member Portal** (`/portal`)
2. Their `non_member_profiles` row is auto-created
3. The database trigger matches their email to the pending import and creates their class pass
4. Their passes appear immediately in the portal

This flow is correct and functional.

### Proposed Fixes

**Fix 1: Personalize the activation email**

Pass `first_name` from the pending import record into the email template so it reads "Hi Samar," instead of a generic greeting.

- Modify `BulkNonMemberImport.tsx` to send `{ email, first_name }` in the email data
- Update the `account_activation_invite` template in `send-email/index.ts` to use `data.first_name` when available

**Fix 2: Transfer profile data on fulfillment**

Update the `auto_fulfill_pending_import` trigger function to also set `first_name`, `last_name`, and `phone` on the `non_member_profiles` row when creating the class pass.

- Add an `UPDATE non_member_profiles SET first_name, last_name, phone` step inside the trigger

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/admin/BulkNonMemberImport.tsx` | Send `first_name` alongside `email` in the email invocation |
| `supabase/functions/send-email/index.ts` | Add personalized greeting using `data.first_name` |
| Database migration | Update `auto_fulfill_pending_import()` to copy name and phone to `non_member_profiles` |

**Database trigger update (migration SQL):**

The updated trigger will add this step after creating the class pass:

```text
UPDATE non_member_profiles
SET first_name = v_pending.first_name,
    last_name  = v_pending.last_name,
    phone      = v_pending.phone
WHERE user_id = NEW.user_id
  AND (first_name IS NULL OR first_name = '');
```

This ensures the profile is populated with the data you already entered in the bulk import form, so the person's portal shows their name and phone immediately after signup.

