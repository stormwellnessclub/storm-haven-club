## Problem

The Portal sidebar (`src/components/portal/PortalSidebar.tsx`) is unreadable — light background with near-white text.

Cause: PortalSidebar overrides the sidebar CSS tokens inline with a dark palette (`--sidebar-background: 38 25% 6%`, `--sidebar-foreground: 48 16% 84%`), and also hardcodes near-white text on the header (`text-[hsl(48_40%_82%)]`). Those inline overrides aren't landing consistently on every inner element that paints the background (e.g. the outer wrapper `.group.peer` and mobile Sheet path still read the global light tokens), so the visible surface stays light while the text is being pushed to near-white.

MemberSidebar has no inline overrides — it just uses the app's global `--sidebar-*` tokens from `src/index.css` (light cream bg with dark text in light mode) and reads cleanly.

## Fix

Bring PortalSidebar in line with MemberSidebar so it uses the working global sidebar tokens.

1. In `src/components/portal/PortalSidebar.tsx`:
   - Remove the inline `style={{ ... }}` block on `<Sidebar>` that overrides `--sidebar-background`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-accent`, `--sidebar-accent-foreground`.
   - Replace hardcoded header colors `text-[hsl(48_40%_82%)]` and `text-[hsl(48_16%_60%)]` with semantic tokens `text-sidebar-foreground` and `text-sidebar-foreground/70`.
   - Replace hardcoded border `border-[hsl(38_25%_12%)]` with `border-sidebar-border`.
   - Leave menu items, footer, and nav structure unchanged.

No other files touched. No functional/behavior changes — presentation only.

## Out of scope

- Redesigning the sidebar palette.
- Any changes to MemberSidebar, AdminSidebar, or global `--sidebar-*` tokens in `index.css`.
- Mobile bottom nav, header, or main content styling.
