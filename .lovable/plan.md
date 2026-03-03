

# Upgrade Non-Member Portal + Fix Package Linking

## Two Problems Found

### Problem 1: Pending import packages are not linking
When admin adds a pending import (bulk import) for a user who has **already signed up**, the class pass is never created. The `auto_fulfill_pending_import` trigger only fires on new `non_member_profiles` INSERT -- so if the user already has an account, nothing happens. Example: Samar (shannawi@outlook.com) signed up Feb 22, pending import was created Feb 24, and her import is still `status: 'pending'` with 0 class passes.

**Fix:** Add a second trigger on `pending_non_member_imports` INSERT that checks if a matching user already exists and immediately fulfills the import.

### Problem 2: User-facing portal missing features
The non-member portal (/portal) is functional but sparse compared to the member portal. Key gaps:

| Feature | Member Portal | Non-Member Portal |
|---------|:---:|:---:|
| Dashboard with passes + bookings | Yes | Yes |
| Detailed booking history | Yes | Yes |
| Class passes with progress | Yes | Yes |
| Payment history | Yes | Stub (empty page) |
| Recovery booking | Yes | Yes |
| Payment methods | Yes | Yes |
| Cafe ordering | N/A | Missing |

The **Payment History** page is a stub showing "No payment history yet" with no actual data query.

### Problem 3: Admin detail page changes may not be visible
The NonMemberDetail page was already refactored with tabs (Profile, Passes & Bookings, Payments) in the previous change. If it still looks the same, it may be a browser cache issue. No code changes needed here.

---

## Plan

### 1. Database: Add auto-fulfill trigger on pending import creation
Create a new trigger on `pending_non_member_imports` INSERT that:
- Checks if a `non_member_profiles` row already exists with matching email and a `user_id`
- If found, immediately creates the class pass, copies profile data, and marks the import as `fulfilled`
- This handles the case where admin imports packages for users who already have accounts

### 2. Database: Backfill Samar's pending import
Run a one-time migration to fulfill any existing pending imports that match already-registered users.

### 3. Portal: Build real Payment History page
Replace the stub `src/pages/portal/PaymentHistory.tsx` with a functional page that:
- Queries `manual_charges` by `user_id` to show admin-initiated charges
- Queries `class_passes` purchases (non-zero `price_paid`) for pass purchase history
- Displays date, description, amount, and status in a clean list

### 4. Verify admin detail page
The admin NonMemberDetail page was already upgraded with the three-tab layout. If you're still seeing the old flat layout, try a hard refresh (Ctrl+Shift+R). No code changes needed.

## Technical Details

### Database migration (new trigger)
```sql
CREATE OR REPLACE FUNCTION public.auto_fulfill_import_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Check if user already has an account
  SELECT * INTO v_profile
  FROM public.non_member_profiles
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NOT NULL
  LIMIT 1;

  IF FOUND THEN
    -- Create class pass immediately
    INSERT INTO public.class_passes (...)
    VALUES (v_profile.user_id, NEW.pass_category, ...);

    -- Mark fulfilled
    NEW.status := 'fulfilled';
    NEW.fulfilled_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_fulfill_import_on_insert
  BEFORE INSERT ON public.pending_non_member_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fulfill_import_on_insert();
```

### Backfill query
Fulfill any pending imports where the user already has an account.

### Files to modify
- `src/pages/portal/PaymentHistory.tsx` -- Replace stub with real charge/purchase history

### Files unchanged
- `src/pages/admin/NonMemberDetail.tsx` -- Already upgraded (verify with hard refresh)
- All other portal pages -- Already functional

