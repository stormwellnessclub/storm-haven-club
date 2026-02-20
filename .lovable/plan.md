
## Add "Buy Class Pass" Link to the Schedule Page

### Context

Members and non-members both access `/class-passes` via their respective sidebar ("Buy Passes"). That link already exists in both portals. The gap is the **Schedule page** — it's a public-facing page that shows classes but has no prompt to purchase passes. Someone viewing the schedule has no obvious next step.

### What to add

**1. Schedule page hero — "Buy a Pass" CTA**
Below the existing description paragraph in the Schedule hero section, add a small inline call-to-action that links to `/class-passes`. This appears for all visitors (logged in or not).

```
Need passes? View class pass pricing →
```

Styled as a subtle text link or small outlined button — not intrusive, but clear.

**2. TempClassSchedule banner — "Get Your Pass" prompt**
The soft launch banner at the top of `TempClassSchedule` currently says:
> "Booking opens soon"

Add a line below it:
> "In the meantime, you can purchase class passes to be ready when booking opens."
> [View Class Pass Pricing →]

This directly helps people who are viewing the schedule and want to buy in advance.

### Where members buy passes — current state (no change needed)

Members already have two ways to buy passes:
- **Member sidebar**: "Buy Passes" → `/class-passes` (already there)
- **Member Credits page**: shows credit balances

When a member visits `/class-passes`, they're automatically shown **"Member pricing applied"** (the gold badge added in the previous change). So members are already served — the main gap is the **schedule page having no link at all**.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Schedule.tsx` | Add "View class pass pricing" link in the hero section below the description |
| `src/components/booking/TempClassSchedule.tsx` | Add "Get your pass ready" prompt with link inside the soft launch banner |

### No database changes needed.

### Technical details

**Schedule.tsx** — In the hero section, after the `<p className="text-muted-foreground text-lg">` description, add:

```tsx
<div className="mt-4">
  <Link to="/class-passes" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
    View class pass pricing
    <ChevronRight className="h-3 w-3" />
  </Link>
</div>
```

`Link` and `ChevronRight` are already imported in `Schedule.tsx`.

**TempClassSchedule.tsx** — Inside the soft launch banner div, add below the existing `<p>`:

```tsx
<Link to="/class-passes" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1">
  Purchase a class pass to be ready when booking opens
  <ChevronRight className="h-3 w-3" />
</Link>
```

`Link` needs to be imported from `react-router-dom` in `TempClassSchedule.tsx` (currently not imported — will add it). `ChevronRight` is already imported there.
