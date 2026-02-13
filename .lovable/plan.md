

## Fix: Allow Same-Day and Backdated Wellness Credit Bookings for Front Desk

### Problem
When front desk staff books a wellness session (Red Light Therapy / Dry Cryo) for a member using their credits, the date picker only allows selecting **future dates** (tomorrow onward). Staff need to:
- Book for **today** (same-day)
- **Backdate** bookings (e.g., a member used a session yesterday but it wasn't logged)

### Solution
Remove the date restriction on the admin wellness booking calendar in `MemberDetail.tsx`. Since this is a staff-only action (not member-facing), there's no reason to block past dates.

### What Changes

**File: `src/pages/admin/MemberDetail.tsx`** (1 line change)

Current (line 2058):
```tsx
disabled={(date) => date < new Date()}
```

Updated -- remove the `disabled` prop entirely so staff can pick any date:
```tsx
// No disabled prop -- staff can select today or past dates
```

This is a single-line fix. The calendar will allow staff to select any date -- today, past, or future -- when booking wellness sessions using member credits.

### Why No Additional Guardrails Are Needed
- This dialog is only accessible to admin/manager/front desk roles via the Member Detail page
- The credit balance check already prevents overbooking (button is disabled if no credits remain)
- Backdating is a legitimate use case for logging sessions that already happened

