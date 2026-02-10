

## Robust Guest Pass Management Overhaul

The current admin Guest Passes page is essentially a basic list with a quick-sale card. Here's what we'll build to make it a full-featured operational hub:

---

### 1. Summary Dashboard Cards (Top of Page)

Replace the simple "Today's Guests" card with a row of 4 KPI cards:

| Card | Data Source |
|------|------------|
| **Today's Guests** | Count where `valid_date = today`, split by "Expected" (active) vs "Checked In" (exhausted/used_at set) |
| **This Week Revenue** | Sum of `price_paid` where `purchased_at` is within current week |
| **Active Passes** | Count where `status = 'active'` and `expires_at > now()` |
| **Total Revenue (Period)** | Sum of `price_paid` for the selected date range |

---

### 2. Enhanced Quick Sale Card

Current quick sale only captures name and email. We'll expand it to match the public form:

- Add **Phone Number** field
- Add **Sex** selector (Female/Male) with the same stealth "at capacity" block for male
- Add **Visit Date** picker (defaults to today)
- Add **Guest of (Member Name)** optional field
- Show the gender block inline if male is selected, disable the button

---

### 3. Admin Actions on Each Guest Pass

Currently you can only view details. We'll add actionable controls:

- **Mark as Checked In**: Sets `used_at = now()` and `status = 'exhausted'` -- prominently displayed for today's active guests
- **Mark as No-Show**: For guests who didn't arrive (sets a note or status)
- **Resend Confirmation**: Trigger a confirmation email to the guest
- **Cancel / Refund**: For passes not yet used, initiate a refund flow
- **Edit Visit Date**: Already exists in the detail sheet, keep it

---

### 4. Better Guest Pass List with Tabs

Replace the single flat list with a tabbed view:

| Tab | Filter | Purpose |
|-----|--------|---------|
| **Today** | `valid_date = today` | Operational focus -- who's coming today |
| **Upcoming** | `valid_date > today AND status = 'active'` | Future bookings |
| **All Passes** | No filter (date range still applies) | Full history |

Each row will show:
- Guest name, email, phone
- Visit date (formatted nicely)
- Status badge (Active / Checked In / Expired / No-Show)
- Member referral (if any)
- Add-ons purchased (badge count)
- Revenue amount
- Quick action buttons (Check In for today's guests)

---

### 5. Enhanced Detail Sheet

The current `GuestDetailSheet` is decent. We'll add:

- **Check-in button** at the top for active passes
- **Gender display** (will need to add `guest_gender` column to the table)
- **Waiver status** indicator (signed/not signed)
- **Admin notes** section -- ability to add internal notes about the guest
- **Activity log** showing when the pass was created, checked in, date changed, etc.

---

### 6. Database Changes

Add a `guest_gender` column to the `guest_passes` table to track the gender selection (currently only validated server-side but not stored):

```sql
ALTER TABLE guest_passes ADD COLUMN guest_gender text;
ALTER TABLE guest_passes ADD COLUMN admin_notes text;
ALTER TABLE guest_passes ADD COLUMN checked_in_by uuid REFERENCES auth.users(id);
ALTER TABLE guest_passes ADD COLUMN no_show boolean DEFAULT false;
```

---

### Technical Details

| File | Changes |
|------|--------|
| `src/pages/admin/GuestPasses.tsx` | Complete overhaul: KPI cards, tabbed list, enhanced quick sale, inline check-in actions |
| `src/components/admin/GuestDetailSheet.tsx` | Add check-in button, gender display, admin notes, activity log |
| Database migration | Add `guest_gender`, `admin_notes`, `checked_in_by`, `no_show` columns to `guest_passes` |
| `supabase/functions/stripe-payment/index.ts` | Store `guest_gender` when creating guest pass record |
| `src/pages/GuestPass.tsx` | Pass `guest_gender` to edge function (already does this, just confirm it's stored) |

### Files Unchanged
- `src/components/admin/AdminSidebar.tsx` -- already has the notification badge, no changes needed

