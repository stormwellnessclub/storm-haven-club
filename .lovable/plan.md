

## Fix: "Function does not exist" error when adding participants to class roster

### Root Cause

The `ClassRosterDialog.tsx` component calls the `find_or_create_temp_class_session` database function with **wrong parameter names**. It uses `p_` prefixed names (`p_class_name`, `p_session_date`, etc.) but the actual function expects `_` prefixed names (`_class_name`, `_session_date`, etc.).

This causes a "function does not exist" error because PostgreSQL matches functions by both name AND parameter names.

### The Fix

**File: `src/components/admin/ClassRosterDialog.tsx`** (lines 244-250)

Change the `ensureSession` function's RPC call parameters from:

```text
p_class_name  -->  _class_name
p_session_date  -->  _session_date
p_start_time  -->  _start_time
p_end_time  -->  _end_time
p_max_capacity  -->  _max_capacity
p_room  -->  (remove, not a parameter of this function)
```

The function only accepts 5 parameters: `_class_name`, `_session_date`, `_start_time`, `_end_time`, `_max_capacity`. The extra `p_room` parameter also needs to be removed as it does not exist on the function.

This is a one-line fix (updating the parameter object) in a single file.

