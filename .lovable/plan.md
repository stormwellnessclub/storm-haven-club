

## Fix: Credits Not Showing and Cannot Be Added for Some Members

### Problem Identified

After investigating the code and database, there are two issues with the credit management:

### Issue 1: `.or()` Filter May Silently Fail

The credit query on line 309 uses:
```
.or(`expires_at.gt.${new Date().toISOString()},credits_remaining.gt.0`)
```

The ISO timestamp includes special characters (`:`, `+`, `.`) that can cause issues with PostgREST's filter parsing. If the filter fails silently, no credits would be returned -- making it appear as if a member has no credits even when they do.

**Fix**: Wrap the timestamp value in double quotes to ensure PostgREST parses it correctly:
```
.or(`expires_at.gt."${new Date().toISOString()}",credits_remaining.gt.0`)
```

### Issue 2: Adding Credits When `credits_remaining` is 0

When a member has an existing credit row with `credits_remaining = 0` **and** the expiration is in the past, the old `.gt()` filter (before the previous fix) would not return it. The new `.or()` filter should return it since `credits_remaining.gt.0` catches any positive balance -- but a row with 0 remaining would be invisible. This means when the admin tries to "add" credits, the code looks for an existing credit record, doesn't find one, and tries to INSERT a new row. If there's already a row for that credit type (even expired with 0 remaining), the insert succeeds and creates a duplicate -- but the update path is skipped.

This isn't a blocker per se, but could cause confusion. The real blocker is Issue 1.

### Changes

**File**: `src/pages/admin/MemberDetail.tsx`

1. **Fix the `.or()` filter** (line 309): Quote the ISO timestamp value properly
2. **Broaden the credit query** to include all credits for the member (remove the filter entirely and let the UI decide what to show), OR use a simpler filter approach that avoids special character issues

### Technical Details

The fix is a single-line change:

```typescript
// Before (line 309):
.or(`expires_at.gt.${new Date().toISOString()},credits_remaining.gt.0`)

// After:
.or(`expires_at.gt."${new Date().toISOString()}",credits_remaining.gt.0`)
```

This ensures PostgREST correctly parses the timestamp value in the OR clause.

