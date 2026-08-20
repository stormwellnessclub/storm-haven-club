# Extended Massage Time (per-minute upgrade)

Add a manual "Extended time" upgrade in the spa checkout dialog so a 90-minute massage can be turned into a 2-hour massage by adding 30 extra minutes at $2/minute ($60).

## What you'll see

In the spa completion / "Edit Payment" dialog, under the add-ons list:

- An **Extended Time** row with a minutes box (e.g. 15, 30, 45) and a rate box pre-filled at **$2.00/min**.
- Live label: `Extended time — 30 min x $2.00 = $60.00`.
- The extra minutes and charge flow into the existing breakdown:

```text
Massage — 90 min             $170.00
Extended time (30 min)        $60.00
                            ---------
Subtotal                     $230.00
Tip (20%)                     $46.00
Total charged                $276.00
```

- Tips calculate on the full subtotal including the extension.
- The appointment's duration is updated (90 -> 120 min) so history, payroll, and the receipt show the real session length.
- The itemized receipt email lists "Extended time (30 min)" as its own line.
- Rate is editable per checkout in case you want to charge something other than $2/min; leaving minutes at 0 changes nothing.

Only shown for massage/body-type services (same category matching already used for add-ons); it can be shown for all services if you prefer — say the word.

## Technical notes

- `SpaCompletionDialog.tsx`: new state `extraMinutes` and `extraRate` (default 2). Derived `extendedCharge = extraMinutes * extraRate`, folded into `addonsTotal`/`subtotal` so tip, Stripe charge amount, and description all pick it up automatically.
- Persisted as a synthetic entry in the existing `addons` jsonb array: `{ id: "extended-time", name: "Extended time (30 min)", price: 60, minutes: 30, rate: 2 }` — no migration needed, and it re-hydrates on reopening the dialog (parsed back into the minutes/rate fields rather than shown as a checkbox add-on).
- On save, also write `duration_minutes = booked duration + extraMinutes` (only when extraMinutes > 0), guarding against double-adding on repeat edits by using the stored extension entry as the baseline.
- Receipt payload already accepts an `addons` array, so the extension appears itemized with no edge-function change; the `durationMinutes` field sends the extended duration.
