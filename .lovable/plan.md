## Goal
Make the Member Lookup detail view render at full usable width and stop it from closing unexpectedly while the front desk is managing credits.

## Changes

### 1. `src/components/admin/MemberDetailSheet.tsx`
- Change `SheetContent` className from `w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto` to a responsive full-width sheet that scales with viewport instead of capping at breakpoints:
  - `w-screen max-w-none sm:max-w-[95vw] lg:max-w-[1200px] xl:max-w-[1400px] overflow-y-auto`
  - This guarantees ~95% viewport width at every size (fixes the 948px viewport where `lg:` never engages and the sheet was stuck at 768px), while capping at 1400px on ultra-wide.
- Add `onEscapeKeyDown={(e) => e.preventDefault()}` to `SheetContent` alongside the existing `onPointerDownOutside` / `onInteractOutside` handlers so accidental Escape presses (or bubbled key events from inner dialogs) don't dismiss the sheet mid-edit.
- Keep the close (X) button as the only intentional dismissal path.

### 2. `src/pages/frontdesk/Members.tsx`
- No layout changes needed — the sheet width fix flows through automatically.

## Out of scope
- No changes to admin routing, permissions, or credit RPCs.
- No changes to any other consumer of `MemberDetailSheet` beyond the width/dismissal behavior (all consumers benefit equally).

## Technical notes
- Tailwind's `sm:max-w-3xl` (768px) was the effective cap on the current 948px front-desk viewport because `lg:` needs ≥1024px. Switching to viewport-relative `max-w-[95vw]` removes that dead zone.
- Radix `Sheet` (Dialog) closes on: outside click, pointer-down-outside, Escape, or explicit close. We already block the first two; adding Escape prevention covers the last remaining accidental-exit path.