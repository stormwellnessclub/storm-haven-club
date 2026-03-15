

## Small Copy Updates on Apply Page

Two quick changes to `src/pages/Apply.tsx`:

### 1. Update Membership Selection intro text (line 732)
Change the current text to:
> "Select the tier that aligns with your wellness goals. You'll have the opportunity to discuss your choice during your private walkthrough — nothing is finalized until you've been approved and you visit the club."

### 2. Add a link to view membership tiers
Below the intro text (after line 733), add a small link like:
```
Not sure which tier is right for you? View membership tiers →
```
Linking to `/memberships`, styled as a small muted link with an accent hover.

### Files Modified
- `src/pages/Apply.tsx` — lines 731-733 area only

Everything else from the original plan is already implemented (hero copy, payment removal, step intros, agreements rewrite, founding member copy, submit button text, confirmation message, abandonment tracking, confirmation email).

