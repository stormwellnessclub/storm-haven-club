# Make the Announcements screen easy to find

My earlier directions were useless. The card does exist, but it is buried: it lives as the 3rd tab inside Admin → Marketing, and that tab row has 10 tabs in a single non-scrolling strip, so on most screens the later tabs get cut off and there is no visible way to reach them.

## Direct link right now

`/admin/marketing?tab=announcements` — that URL opens straight to the Announcements tab, where the "Tonight's Early Closing (9:00 PM)" card sits with Preview email / Send test / Send email blast.

## What to change

1. Add an **Announcements** item to the admin sidebar (bell icon), in the Administration group directly under Marketing, linking to `/admin/marketing?tab=announcements`.
2. Make the Marketing tab strip horizontally scrollable and wrap-safe so no tab is ever hidden off-screen.
3. Highlight the sidebar item as active when that tab is open.

## Technical notes

- `src/components/admin/AdminSidebar.tsx`: new entry in the Administration group; active-state matching must compare the query string, not just the pathname.
- `src/pages/admin/Marketing.tsx`: wrap `TabsList` in an overflow-x-auto container (or allow flex-wrap) so all 10 triggers stay reachable on laptop and tablet widths.
- No backend, email, or template changes. Nothing is sent.
