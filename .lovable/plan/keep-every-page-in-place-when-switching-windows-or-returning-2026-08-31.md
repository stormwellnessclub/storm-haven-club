# Keep Every Page in Place When Switching Windows or Returning

## Goal
Stop the website from resetting to the top, losing the selected person, or clearing the working view when staff switch browser windows/tabs or navigate into a record and return.

## Verified causes
- The shared role hook marks permissions as loading again whenever the authenticated session object refreshes. Protected admin and front-desk routes replace the entire page with a full-screen verifier during that refresh, which unmounts the current screen and destroys local UI state.
- The app-wide query client uses focus refetching by default, so returning to a browser window can refresh every active screen at once.
- The global scroll component sends every pathname change to the top, including browser Back navigation, rather than restoring the previous page position.
- Some directories already preserve filters in the URL, but other high-use lists—such as PT Clients—keep filters only in component memory.

## Implementation
1. **Keep protected pages mounted during background permission checks**
   - Change role refreshes so the blocking loading state is used only for the initial access check.
   - Once access has been verified, refresh permissions in the background without replacing the current admin/front-desk page.
   - Preserve the existing denied-access and retry behavior when the initial verification genuinely fails.

2. **Make returning to a browser window non-disruptive**
   - Disable automatic app-wide refetch-on-window-focus.
   - Keep explicit polling, realtime subscriptions, manual refreshes, and screen-specific focus refreshes where the code intentionally requires live operational data.
   - Background data updates must retain the last successful result instead of replacing the screen with a first-load state.

3. **Restore scroll position intelligently**
   - Replace unconditional pathname-based scrolling with navigation-aware behavior.
   - New forward navigation opens at the top.
   - Browser Back/Forward restores the saved scroll position for that history entry.
   - Merely hiding and reopening a tab/window leaves the current scroll position untouched.

4. **Preserve list context and selected records**
   - Store durable directory state—search, filters, active saved view, and selected record identifier—in the URL where appropriate, using stable IDs rather than whole record objects.
   - Start with the shared admin directory pattern and PT Clients, then apply it to the high-use master-detail screens that currently hold this context only in local state.
   - Returning from a person/detail page restores the prior list, filters, selected person, and scroll position; completed submissions may still clear their own drafts as intended.

5. **Verification**
   - Test admin, front desk, PT Clients, Members, Applications, and at least one member/portal list.
   - On each screen: scroll, filter/search, open a person, switch tabs/windows during loading, return, and use browser Back.
   - Confirm there is no full-page verification flash, no reset to the beginning, no lost selection/filter, and no regression to access control or live operational updates.

## Technical scope
Frontend state/navigation only. No database migrations, billing changes, or business-rule changes.
