

## Add "Send Password Reset Link" to Admin Member Detail

### What's Being Added

A new action button in the Member Detail Sheet that lets admins send a password reset email to any member, directly from their profile. This uses the same `supabase.auth.resetPasswordForEmail()` call already used on the self-service `/reset-password` page.

### How It Works

- Admin clicks "Send Password Reset" on a member's detail sheet
- A confirmation dialog appears showing the member's email
- On confirm, the system sends a password reset email to that member
- A success/error toast confirms the result

### Changes

| File | Change |
|------|--------|
| `src/components/admin/MemberDetailSheet.tsx` | Add a "Send Password Reset" `AdminActionButton` with a confirmation dialog. On confirm, call `supabase.auth.resetPasswordForEmail(member.email, { redirectTo: origin + '/update-password' })`. Show success/error toast. |
| `src/components/admin/AdminActionButton.tsx` | Add `sendPasswordReset` tooltip to the `ADMIN_ACTION_TOOLTIPS` constant. |

### Technical Details

- Uses the existing `supabase.auth.resetPasswordForEmail()` API -- no new edge function needed
- The button will use the `AdminActionButton` component with a confirmation config, matching the pattern of other admin actions
- The `KeyRound` icon from lucide-react will be used for the button
- Placed in the member actions area alongside existing buttons like "Add Card" and "Create Subscription"

No database changes needed.

