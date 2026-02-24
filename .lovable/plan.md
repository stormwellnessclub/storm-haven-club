

## Fix: Admin Cannot Cancel Classes

### Root Cause

When you try to cancel a class from the Soft Launch management page, it fails because of a **parameter name mismatch** in a database function call.

The code in `SoftLaunchClassManagement.tsx` calls the function with parameter names starting with `p_` (e.g., `p_class_name`), but the database function expects names starting with `_` (e.g., `_class_name`). This means when a class has no bookings yet (no database record exists), the system can't create one to mark it as cancelled, and the operation fails with an error.

Classes that already have bookings (and therefore already have a database record) may cancel successfully, but any class with 0 enrollments will fail.

### Fix

**File: `src/components/admin/SoftLaunchClassManagement.tsx`** (lines 114-124)

Change the RPC call parameter names from `p_` prefix to `_` prefix to match the database function signature:

```
Before:
  p_class_name  -> _class_name
  p_session_date -> _session_date
  p_start_time  -> _start_time
  p_end_time    -> _end_time
  p_max_capacity -> _max_capacity
  p_room        -> (remove -- not a parameter of this function)
```

This is a one-line fix in a single file. After this change, all class cancellations (both visible and silent) will work regardless of whether the class has existing bookings.

### Summary

| What | Detail |
|------|--------|
| File | `src/components/admin/SoftLaunchClassManagement.tsx` |
| Lines | 114-124 |
| Issue | Wrong parameter names in database function call |
| Fix | Rename `p_*` parameters to `_*` to match the function signature |

