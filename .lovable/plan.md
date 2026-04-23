
Fix the real admin access failure by treating it as a post-login admin-route crash, not a credential/auth failure.

1. Re-anchor the diagnosis around what the evidence now shows
- Treat login itself as succeeding:
  - backend auth logs show successful password login (`/token` 200)
  - follow-up `/user` requests also return 200
- Treat the current blocker as a frontend crash after successful sign-in and redirect to the admin route.
- The screenshot matches the global `ErrorBoundary` fallback, which means the app is crashing during admin page mount/render instead of showing:
  - invalid credentials
  - access denied
  - role retry UI

2. Fix the most likely Safari-specific crash in the admin shell
- Update `src/hooks/use-mobile.tsx`.
- Replace the current `MediaQueryList.addEventListener("change", ...)` / `removeEventListener(...)` usage with a compatibility wrapper:
  - use `addEventListener` / `removeEventListener` when available
  - fall back to `addListener` / `removeListener` for Safari versions that still require it
- Why this is the top suspect:
  - `use-mobile.tsx` is mounted by `SidebarProvider`
  - `SidebarProvider` is used by `AdminLayout`
  - `AdminLayout` is what staff hit immediately after login
  - the homepage can still work while admin crashes
- Expected result:
  - Safari stops crashing as soon as admin layout mounts
  - successful login no longer lands on the global “Something went wrong” screen

3. Harden the admin shell so non-critical widgets cannot white-screen admin
- Review and isolate admin-only mount-time features inside `AdminLayout`:
  - `src/components/admin/AdminSupportChime.tsx`
  - `src/hooks/useAdminSupportNotifications.ts`
  - `src/components/admin/AdminSidebar.tsx`
  - `src/hooks/useUnresolvedFailedCount.ts`
- Keep these features fail-open:
  - notification chime
  - support counts
  - badge counters
- If any of those fail, admin should still render with zero/empty badge states instead of crashing the entire route.

4. Isolate dashboard-only panels from taking down `/admin`
- Add local containment around the most complex dashboard widgets in `src/pages/admin/Dashboard.tsx`, especially:
  - `SupportAlertCard`
  - `BillingHealthWidget`
  - `CardSyncFailuresWidget`
- Goal:
  - a broken widget should collapse to a harmless empty/error card
  - the admin shell, sidebar, and primary navigation must remain usable
- This ensures staff can at least get into admin even if one dashboard block is failing.

5. Re-check auth/routing only after the admin shell is stable
- Keep the earlier auth/role changes unless they directly contribute to the crash.
- Verify the route sequence after sign-in:
  - `/auth`
  - successful session restore
  - role resolution
  - redirect to default admin page
  - admin shell mounts without tripping `ErrorBoundary`
- If needed, simplify the post-login redirect in `src/pages/Auth.tsx` so staff are sent to the first stable admin page only after roles resolve.

6. Validate the full failure chain that the user is actually seeing
- Confirm:
  - admin credentials are accepted
  - no global “Something went wrong” screen appears after login
  - `/admin` loads in Safari on the user’s laptop
  - today’s check-ins no longer show false zero once dashboard loads
- If dashboard still fails after the Safari compatibility patch, use the stabilized admin shell to identify the next crashing widget without locking the user out again.

Technical details
- Most important evidence shift:
  - this no longer looks like a pure auth failure
  - live auth requests succeed, so the failure is very likely after redirect into admin
- Most likely root cause:
  - `src/hooks/use-mobile.tsx` uses `MediaQueryList.addEventListener("change", ...)` with no Safari fallback
  - that hook is pulled in by `SidebarProvider`, which is mounted immediately by `AdminLayout`
- Highest-priority files:
  - `src/hooks/use-mobile.tsx`
  - `src/components/admin/AdminLayout.tsx`
  - `src/components/admin/AdminSidebar.tsx`
  - `src/components/admin/AdminSupportChime.tsx`
  - `src/hooks/useAdminSupportNotifications.ts`
  - `src/hooks/useUnresolvedFailedCount.ts`
  - `src/pages/admin/Dashboard.tsx`
  - `src/pages/Auth.tsx` if redirect cleanup is still needed

Expected result
- You can sign in successfully.
- Admin no longer crashes immediately on Safari/laptop.
- The app stops dumping you into the global error screen.
- Once admin loads again, the check-in counts can be verified and corrected from a working session.
