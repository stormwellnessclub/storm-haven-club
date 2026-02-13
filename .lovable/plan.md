

## Add Member Guest Registration and Admin Guest Tracking Portal

### Problem
Currently, guest passes are only managed by admin staff. Members who have complimentary guest pass credits see a registration form on `/member/credits`, but it only has a single "Guest Name" field (not split into first/last), and email/phone are optional. Members need a proper way to register their guests with complete information. Admin also needs a dedicated portal to view and track all registered guests.

### What Changes

#### 1. Update Guest Registration Form for Members (`src/pages/member/Credits.tsx`)

Update the `GuestPassRegistrationCard` component:
- Replace single "Guest Name" field with **First Name** and **Last Name** as separate required fields
- Make **Email** required
- Make **Phone Number** required
- Concatenate first + last name when saving to `guest_name` in the database (the existing column stays as-is)

**Before:**
```
Guest Name *        [Full name____________]
Email               [Optional_____________]
Phone               [Optional_____________]
Visit Date *        [date picker__________]
```

**After:**
```
First Name *        [___________________]
Last Name *         [___________________]
Email *             [___________________]
Phone Number *      [___________________]
Visit Date *        [date picker________]
```

#### 2. Add Guest Registration to Member Sidebar (`src/components/member/MemberSidebar.tsx`)

Add a "Register Guest" link in the member navigation sidebar so members can easily find the guest registration feature (links to `/member/credits` where the form lives).

#### 3. Update Admin Guest Passes Page as Guest Tracking Portal (`src/pages/admin/GuestPasses.tsx`)

The admin Guest Passes page already has a comprehensive table with today/upcoming/all tabs, KPIs, search, and detail sheets. This effectively serves as the tracking portal. However, to better distinguish member-registered guests vs admin-created ones:
- Add a column or badge showing **"Source"** (e.g., "Member" vs "Admin" vs "Public") based on the `member_referral` field
- Ensure member-registered guests (those with `user_id` set and `member_referral = "Complimentary Guest Pass"`) are clearly visible

### Technical Details

**File: `src/pages/member/Credits.tsx`**
- Split `guestName` state into `guestFirstName` and `guestLastName` (both required)
- Make `guestEmail` and `guestPhone` required in validation
- On submit, set `guest_name: guestFirstName.trim() + " " + guestLastName.trim()`
- Update form UI with separate input fields on their own lines
- Update the success message to show the full name

**File: `src/components/member/MemberSidebar.tsx`**
- Add a "Register Guest" nav item (with Gift icon) linking to `/member/credits`

**File: `src/pages/admin/GuestPasses.tsx`**
- In the table rows, add a small badge or label indicating source: if `member_referral === "Complimentary Guest Pass"` show "Member", if `stripe_payment_id` exists and no referral show "Public", otherwise "Admin"
- This gives staff quick visibility into where each guest registration originated

### No Database Changes Needed
The `guest_passes` table already has all required columns (`guest_name`, `guest_email`, `phone_number`, `valid_date`, `user_id`, `member_referral`). We just need to update the frontend forms to collect the data properly and make fields required.

