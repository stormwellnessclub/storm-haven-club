I found the tracking is already built, but it is only nested inside **Spa Management** as a tab at:

`/admin/spa-management?tab=mothers-day`

I also verified the backend table exists and currently contains Mother’s Day voucher records. So the issue is visibility/navigation, not that purchases are missing.

## Plan

### 1. Add a direct sidebar link for tracking
Add a dedicated admin sidebar item under **Wellness & Spa**:

`Mother’s Day Tracking` → `/admin/mothers-day`

This avoids relying on a nested Spa Management tab that can be easy to miss.

### 2. Add a standalone admin route
Create a direct route:

`/admin/mothers-day`

It will render the existing Mother’s Day tracking/admin UI directly, with:
- Sold / active / redeemed counts
- Revenue + net revenue
- Buyer details
- Recipient/gift details
- Processing fee details
- Sale source filter: online vs in-house
- Export CSV
- Resend voucher email
- Sell in-house button

### 3. Keep the existing Spa Management tab too
Leave the existing `Mother’s Day` tab inside Spa Management, but update it so both paths work:

- `/admin/spa-management?tab=mothers-day`
- `/admin/mothers-day`

### 4. Fix permissions so the right staff can see it
Update admin permissions so the Mother’s Day tracking page is visible to the same roles that can manage these sales:

- super admin
- admin
- manager
- front desk
- spa staff

Right now, the underlying voucher data allows front desk/staff access, but the Spa Management page permission is narrower than the sidebar department, which may be why it is not showing for some staff accounts.

### 5. Improve the label in Spa Management
Change the tab label from:

`Mother’s Day 💛`

to something more obvious:

`Mother’s Day Tracking`

### 6. Add a clear empty/loading/error state
If the tracking table fails to load due to permissions or network issues, show a visible admin-facing error instead of looking like the tab/page is missing.

## Result

After this, you will be able to access Mother’s Day tracking from the admin sidebar directly, without hunting through Spa Management tabs. The existing purchased vouchers will appear there, including gift recipient details and resend-email controls.