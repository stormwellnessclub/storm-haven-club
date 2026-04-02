

# Fix Rola's Membership Agreement + Improve Error Resilience

## Immediate Fix
Use a database update to mark Rola Taleb's membership agreement as signed right now so she's unblocked.

```sql
UPDATE profiles 
SET membership_agreement_signed = true, 
    membership_agreement_signed_at = now(), 
    updated_at = now() 
WHERE user_id = '9df22a76-c800-442c-8272-20a912eb9a73';
```

## Code Improvement
Harden the signing mutation in `useUserProfile.ts` to prevent silent failures:

- Remove `.single()` from the membership agreement update mutation — if 0 rows are returned (e.g. due to RLS timing), `.single()` throws. Use `.maybeSingle()` instead and throw a clear error if no row is returned.
- Add the same fix to all other signing mutations (waiver, kids care, guest pass, etc.) for consistency.

### File: `src/hooks/useUserProfile.ts`
- Change `.select().single()` to `.select().maybeSingle()` in all sign mutations
- Add explicit check: `if (!data) throw new Error("Profile not found — please try again")`

This is a 1-file change plus a database migration to fix Rola immediately.

