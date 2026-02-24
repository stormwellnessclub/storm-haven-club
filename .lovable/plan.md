

## Add Admin Check-In History Log

### Problem

The admin check-in page (`/admin/check-in`) only shows **today's check-ins**. There is:
1. **No way to view past check-in history** -- once the day is over, those records disappear from the admin view
2. **No per-member check-in history** visible from the admin member detail sheet
3. The existing `DailyCheckinsReport` in the Reports section shows aggregate counts but not individual records with names/times

### Solution

Two additions to give admins full visibility:

---

### 1. New Admin Page: `/admin/check-in-history`

A dedicated "Check-In History" page with:

- **Date range picker** (default: last 7 days) to browse any time period
- **Search/filter** by member name, member ID, or membership type
- **Full table** showing: Photo, Name, Member ID, Membership Type, Status, Check-In Time, Check-Out Time, Notes (including override notes)
- **Clickable rows** that navigate to the member's detail page
- **Export-friendly** layout (sortable columns)
- **Summary stats** at the top: total check-ins, unique members, avg per day for selected range

**Files to create:**
- `src/pages/admin/CheckInHistory.tsx` -- new page component

**Files to modify:**
- `src/App.tsx` -- add route `/admin/check-in-history`
- `src/components/admin/AdminSidebar.tsx` -- add "Check-In History" link under Quick Access (next to Check-In), with `ClipboardList` icon, accessible to `super_admin`, `admin`, `manager`, `front_desk`

---

### 2. Check-In History Tab on Member Detail Sheet

Add a "Visit History" tab inside `MemberDetailSheet.tsx` that shows:

- The member's last 50 check-ins with dates, times, and notes
- Total visit count and visits this month
- Uses the existing `useCheckInHistory` hook (already supports passing a `memberId`)

**Files to modify:**
- `src/components/admin/MemberDetailSheet.tsx` -- add a new tab to the existing Tabs component showing that member's check-in records

---

### Technical Details

**New page query pattern** (for `/admin/check-in-history`):
```sql
SELECT ci.*, m.first_name, m.last_name, m.member_id, m.membership_type, m.status, m.photo_url
FROM check_ins ci
JOIN members m ON ci.member_id = m.id
WHERE ci.checked_in_at BETWEEN :start AND :end
ORDER BY ci.checked_in_at DESC
LIMIT 500
```

No database changes needed -- the `check_ins` table already has all the data; it's just not exposed in the admin UI beyond today.

**Sidebar placement:** "Check-In History" will appear right below the existing "Check-In" item in Quick Access, using a `ClipboardList` icon.

### Summary

| Change | File |
|--------|------|
| New page with date range, search, full table | `src/pages/admin/CheckInHistory.tsx` (new) |
| Add route | `src/App.tsx` |
| Add sidebar link | `src/components/admin/AdminSidebar.tsx` |
| Add visit history tab to member detail | `src/components/admin/MemberDetailSheet.tsx` |

