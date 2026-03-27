

# Staff Portal Access Control — Revised

Same plan as before, but **Founding Members count/stats remain visible to all staff roles**, not just admins.

## Dashboard visibility by role

**Hidden from non-admin roles (front_desk, spa_staff, etc.):**
- Pending Applications (stat card + list)
- Failed Payments alert
- Billing Health Widget
- Card Sync Failures Widget
- "Send Hours Email" button
- Revenue/finance stats

**Visible to ALL staff roles (including front_desk):**
- Today's Check-Ins
- Appointments Today
- Today's Classes count
- Support Alert Card
- Quick action: Open Scanner
- **Founding Members count/stats** ← kept visible per your request
- **Active Members count**

## File changes
- **Edit**: `src/pages/admin/Dashboard.tsx` — import `useUserRoles`, wrap admin-only sections (applications, billing, payments, revenue) with `isAdmin()` checks; leave founding member and active member stats unwrapped

