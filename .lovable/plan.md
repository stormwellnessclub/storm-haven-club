
## Sound Bath vote — preview, cutoff fix, "Either works" option, and prominent description toggle

Five small changes. No schema changes.

### 1. Add a third option: "Either works for me"

`src/lib/eventVote.ts` — append to `options`:

```ts
{ key: "either", label: "Either works for me", time: "No preference" }
```

Flows through automatically:
- `EventVoteCard` renders a third button under Friday/Saturday
- `event_vote_tallies` view aggregates the third bucket
- Admin tracking page shows a third bar + row

Visual tweak in `EventVoteCard.tsx`: "either" uses a neutral icon (`Sparkles` or `CalendarCheck`) and no time chip.

### 2. Make "Read full description" prominent

In `src/components/events/EventVoteCard.tsx`, replace the plain `<details><summary>` link with a full-width outlined button-style toggle:

- Bordered, rounded, padded row spanning the card width
- Icon + label: **"Read full event description"** with a chevron on the right that rotates when open
- Bold text, `text-primary`, subtle background tint on hover
- Still uses `<details>` under the hood (no new state) so it stays keyboard/screen-reader accessible

Result: impossible to miss compared to the current tiny inline link.

### 3. Move voting cutoff to July 15, 2026

`src/lib/eventVote.ts` — change `closesAt` to `2026-07-15T23:59:59-05:00`. Portal card helper text and admin header update automatically. Add a "Voting closes Wednesday, July 15" line under the CTAs in the email.

### 4. Add the third option + closing date to the email

`send-sound-bath-vote-blast/index.ts` HTML:
- Third CTA button under Saturday: **"Either works for me"** → `…?vote=sound-bath-jul-2026&choice=either`, styled as outline/secondary so Fri/Sat stay primary
- New line under the CTAs: *Voting closes Wednesday, July 15.*

### 5. Preview button on the admin tracking page

a. **Edge function** — extract `buildHtml(firstName)` and add a preview branch:
   - Still requires admin auth (`requireStaff`)
   - When body contains `{ preview: true }`, returns raw HTML (sample `firstName = "Jane"`) with `Content-Type: text/html`
   - Skips Resend + dedupe

b. **Admin UI** — new `src/components/admin/PreviewVoteEmailButton.tsx`, mounted next to `SendVoteBlastButton` on `/admin/event-votes/sound-bath-jul-2026`:
   - Calls the function with `{ preview: true }` via `supabase.functions.invoke`
   - Opens a `Dialog` (~700px wide, 80vh tall) with `<iframe srcDoc={html}>`
   - Links inside the preview open the real deep-link route in a new tab so you can verify scroll-to-option behavior for all three choices

### 6. Files touched

Edited:
- `src/lib/eventVote.ts` — add "either" option, move cutoff to Jul 15
- `src/components/events/EventVoteCard.tsx` — bold description toggle, "either" option icon/style
- `supabase/functions/send-sound-bath-vote-blast/index.ts` — third CTA, closing-date line, preview branch
- `src/pages/admin/EventVoteTracking.tsx` — mount preview button

Created:
- `src/components/admin/PreviewVoteEmailButton.tsx`

### 7. Verification pass

1. Open the preview modal, confirm all three CTAs render and the closing date reads July 15.
2. Click each CTA — confirm `/member?vote=…&choice=friday_jul_24|saturday_jul_25|either` scrolls the correct option into view.
3. Confirm the "Read full event description" toggle is clearly visible and expands/collapses.
4. Confirm the tracking page shows three bars once test votes exist.
