
## Fix: Enable Booking on Soft Launch Schedule + Strengthen the Banner

### Two issues to fix

**Issue 1 — Booking is still disabled on the Soft Launch tab**

In `src/components/booking/TempClassSchedule.tsx`, the `TempClassCard` component always renders a greyed-out disabled button:

```tsx
<Button disabled variant="outline" size="sm" className="flex-1 opacity-50">
  Book
</Button>
<span className="text-xs text-muted-foreground whitespace-nowrap">
  Opens soon
</span>
```

This needs to become a real, clickable "Book Class" button. The `TempClassSchedule` component is a static display-only component — it doesn't connect to real `ClassSession` data, so booking via the existing `BookingModal` isn't directly possible. The fix is to pass an `onBook` callback from `Schedule.tsx` into `TempClassSchedule`, but since the temp schedule uses static data (not real session IDs), the cleanest approach is to wire it to navigate to the live booking session on the Full Schedule tab, or — the right way — connect the static class cards to the real `useClassSessions` data.

However, looking at the architecture, the cleanest fix the user is asking for is: **remove the disabled state and "Opens soon" text so the button is active and triggers the booking flow**. Since the temp schedule cards don't have real session objects, the card should link the user to the "Full Schedule" tab where they can book the matching real session.

The approach:
- Add an `onBook` prop to `TempClassCard` and `TempClassSchedule`
- When clicked, scroll up and switch to the "Full Schedule" tab in `Schedule.tsx`
- Alternatively (simpler), just make the button active and have it trigger a tab switch via a callback from `Schedule.tsx`

The simplest correct fix: pass a callback `onBookRequest` from `Schedule.tsx` into `TempClassSchedule` that switches the tab to "full". The button label changes to "Book Class" and clicking it takes them to the live Full Schedule tab where their session exists and can be booked. The `isSoftLaunch` flag in `Schedule.tsx` is also set to `false` to enable booking on the Full Schedule tab too.

**Issue 2 — Banner is too subtle**

The current banner:
```tsx
<div className="bg-primary/5 border border-primary/20 rounded-lg py-4 px-6">
```

This is nearly invisible. It needs a stronger gold/accent treatment — more padding, a bolder background, and possibly an icon with more presence. The text "Booking opens soon" also needs to change to reflect that booking is now active.

### Files to Modify

**`src/components/booking/TempClassSchedule.tsx`**

1. Add an `onBookRequest?: () => void` prop to `TempClassSchedule`
2. Pass it down to `TempClassCard`
3. Change the disabled button to an active "Book Class" button that calls `onBookRequest`
4. Update the banner: stronger background (`bg-gold/10 border-gold/40`), more padding, bolder text, update the "Booking opens soon" copy to "Book now — classes are live"
5. Update the footer note at the bottom to remove "booking will be available soon"

**`src/pages/Schedule.tsx`**

1. Set `isSoftLaunch = false` to enable booking on the Full Schedule tab
2. Pass an `onBookRequest` callback into `<TempClassSchedule />` that switches the tab to `"full"` — this requires lifting tab state so we can control it programmatically (switch `Tabs` from `defaultValue` to `value` + `onValueChange`)

### Exact changes

**Schedule.tsx:**
- Add `const [activeTab, setActiveTab] = useState("temp");`
- Change `isSoftLaunch` to `false`
- Change `<Tabs defaultValue="temp">` → `<Tabs value={activeTab} onValueChange={setActiveTab}>`
- Pass `onBookRequest={() => setActiveTab("full")}` to `<TempClassSchedule />`

**TempClassSchedule.tsx:**
- Add `onBookRequest?: () => void` prop to the component and card
- Change disabled button to: `<Button size="sm" className="w-full" onClick={onBookRequest}>Book Class</Button>`
- Upgrade banner styling to gold-tinted, more prominent
- Change copy from "Booking opens soon" to "Booking is now live"
- Remove the footer disclaimer about booking not being available yet

No database or edge function changes needed.
