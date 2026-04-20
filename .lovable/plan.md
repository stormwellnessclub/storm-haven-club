

The Staff Schedule link should appear in the admin sidebar under the **Administration** section. Looking at `AdminSidebar.tsx`, it's there (line ~127: `{ title: "Staff Schedule", url: "/admin/staff-schedule", icon: CalendarDays }`).

The Administration section is restricted to `super_admin` and `admin` roles only. If the user has a different role (manager, front_desk, etc.), they won't see it.

## Where to find it

**Desktop**: Go to `/admin` (the admin portal). In the left sidebar, scroll down to the **Administration** section header → click it to expand if collapsed → "Staff Schedule" (calendar icon).

**Mobile**: Open the admin sidebar (hamburger/trigger top-left) → expand **Administration** → tap "Staff Schedule".

**Direct URL**: https://stormwellnessclub.com/admin/staff-schedule

## If you still don't see it

Likely cause: the **Administration** group is collapsed. Each department in the sidebar is a collapsible group — click the "ADMINISTRATION" label to expand it. Other possible causes:
1. You're on the public site (`/`) — you need to navigate to `/admin` first
2. Your role doesn't include `admin` or `super_admin`
3. Browser cache — hard-refresh (Cmd/Ctrl+Shift+R)

If after expanding Administration you still don't see it, I can:
- Move it to a more prominent section (e.g., add it to **Operations** so it's visible to managers and front desk too)
- Widen access so managers can also see/use the page
- Add a quick-link card on the main admin Dashboard

No code changes needed unless you want one of the above adjustments — just let me know which.

