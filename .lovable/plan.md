
# Sign Liability Waiver at Account Creation

## Problem Summary

1. **Shaking Form**: The guest pass form "shakes" due to loading state transitions in `InlineWaiverGate` as it checks profile, fetches agreements, and renders the waiver UI
2. **Repeated Signing**: Users must sign waivers every time they purchase a guest pass instead of once per account
3. **Poor UX**: Creates friction for returning users who have already agreed to the liability waiver

## Solution

Move the liability waiver signing into the account creation flow, so users sign once when they join and don't need to re-sign for each purchase.

## Architecture Change

### Current Flow
```text
Sign Up → Redirect to /guest-pass → Show Waiver Gate → Sign Waivers → Show Form
```

### New Flow
```text
Sign Up → Show Liability Waiver Step → Complete → Redirect to /guest-pass → Form Ready
```

## Technical Changes

### 1. Create `WaiverSigningStep` Component

A new component shown after successful account creation that requires the user to sign the liability waiver before proceeding:

- Displays the liability waiver using `SimpleAgreementCard`
- Once signed, redirects to the original destination
- Blocks navigation until waiver is signed

### 2. Modify `Auth.tsx` Sign-Up Flow

After successful sign-up:
1. Wait for profile creation (trigger)
2. Check if `waiver_signed = false`
3. If not signed, show the `WaiverSigningStep` component
4. Once signed, redirect to intended destination

### 3. Simplify `GuestPass.tsx`

- Remove `liability` from `requiredWaivers` array
- Only require `guest_pass` agreement (product-specific)
- Liability waiver is always signed at account creation

### 4. Update Other Purchase Flows (Class Passes, etc.)

For each purchase type:
- Liability waiver: Always signed at account creation (no longer in waiver gate)
- Product-specific waiver: Still required inline (e.g., `guest_pass`, `single_class_pass`)

## Database Schema

No changes needed - the `profiles` table already has:
- `waiver_signed` (boolean, default false)
- `waiver_signed_at` (timestamp)

## File Changes

| File | Change |
|------|--------|
| `src/components/WaiverSigningStep.tsx` | **NEW** - Post-signup waiver signing component |
| `src/pages/Auth.tsx` | Add waiver signing step after successful sign-up |
| `src/pages/GuestPass.tsx` | Remove `liability` from `requiredWaivers`, keep only `guest_pass` |
| `src/pages/ClassPasses.tsx` | Remove `liability` from required waivers if present |

## UI Design

### Post Sign-Up Waiver Screen
```text
+----------------------------------------------------------+
|                    [Storm Wellness Logo]                  |
|                                                          |
|                  Almost There!                           |
|     Please review and sign our liability waiver          |
|            to complete your account setup.               |
|                                                          |
|  +----------------------------------------------------+  |
|  |  Liability Waiver                                  |  |
|  |  ------------------------------------------------  |  |
|  |  Please review the following document:             |  |
|  |                                                    |  |
|  |  Liability Waiver                                  |  |
|  |  [Download PDF]  [Open in New Tab]                 |  |
|  |                                                    |  |
|  |  [ ] I have reviewed this document                 |  |
|  |                                                    |  |
|  |  [I Agree — Sign Liability Waiver]                 |  |
|  +----------------------------------------------------+  |
|                                                          |
|           This is required for all club activities       |
+----------------------------------------------------------+
```

### Simplified Guest Pass Flow (After Change)
```text
User already signed liability waiver at signup
         ↓
Only guest_pass agreement shown (if not already signed)
         ↓
Form appears immediately for returning users
```

## Benefits

- **No more shaking**: Form loads immediately for users who've already signed the liability waiver
- **One-time signing**: Liability waiver is signed once at account creation
- **Faster checkout**: Returning guests see the form immediately
- **Cleaner code**: Waiver gate only handles product-specific agreements
- **Better UX**: Clear, linear onboarding flow

## Edge Cases Handled

1. **Existing users without waiver**: They'll be prompted to sign when they next try to access a protected feature (the `InlineWaiverGate` still works as fallback)
2. **Multiple products**: Each product-specific waiver (guest pass, single class, etc.) is still checked independently
3. **Redirect preservation**: The redirect target is preserved through the waiver signing step
