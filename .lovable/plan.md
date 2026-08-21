# Spa checkout: make the price follow the extra minutes

## What's happening

In the spa Complete/Charge dialog there are two separate controls that don't talk to each other:

- **Adjust price** — a manual override of the service price. When opened it prefills with the originally booked price and never changes again.
- **Extended Time** — extra minutes x $2/min, added as its own line item further down.

So when staff extend a session and then open **Adjust price** to see the new amount, the field still shows the original price (e.g. $150 for the 90-min) with no sign of the extra minutes. The extra time is charged, but the price you're looking at while adjusting it doesn't reflect it, so the math looks wrong.

## The fix

Keep the pricing rule as it is — base service price plus extra minutes x $2/min — but make the number on screen keep up:

1. **The price line updates live.** The amount under the service name shows the running service total (base + extended time) and changes the moment minutes are entered, with a small caption underneath: `$150.00 + 30 min x $2.00 ($60.00)`.
2. **Adjust price starts from the current total.** Opening it prefills with base + extension, not the original booked price. While the field is untouched, typing or changing the extra minutes keeps recalculating it automatically.
3. **Manual entry wins, but is undoable.** Once staff type their own number, auto-recalculation stops (so a hand-set price is never overwritten) and a `Recalculate ($210.00)` link appears next to the field to snap it back to the computed amount. The existing "Reset to $150.00" link stays and resets to the original booked price.
4. **No double counting.** When a manual price is in effect, the extended-time line is folded into that price rather than added on top a second time, and the breakdown labels it clearly (`Adjusted price (includes 30 min extended time)`).
5. **The rate stays editable** and defaults to $2.00/min as today; changing it re-runs the same math.

Nothing about how the charge is saved, receipted, or reported changes — the appointment still stores the longer duration and an itemized extended-time entry.

## Technical details

All in `src/components/admin/spa/SpaCompletionDialog.tsx`:

- Add `computedServiceTotal = bookedPrice + extendedCharge` and a `priceManuallyEdited` flag (set true only in the price input's `onChange`).
- An effect keyed on `computedServiceTotal` writes `setPriceOverride(computedServiceTotal.toFixed(2))` while `priceManuallyEdited` is false and the editor is open; the "Adjust price" button also seeds from `computedServiceTotal`.
- `servicePrice` becomes `overrideValue ?? computedServiceTotal`; when `overrideValue !== null`, drop `extendedEntry` from `chargedAddons` so the extension isn't billed twice, and label the service row accordingly in the breakdown.
- Persisted `member_price`/`service_price` override logic compares against `computedServiceTotal` instead of `bookedPrice`; `duration_minutes` sync and the `EXTENDED_TIME_ID` add-on record for reporting are unchanged (when a manual price is set, the extension entry is still saved with `price: 0` so the minutes stay on record).
- Reset `priceManuallyEdited` in the existing `appointment?.id` effect.

## Verification

- 90-min massage at $150, add 30 min: price line reads $210.00 with the `+30 min x $2.00` caption, Total and the Charge button read $210 plus tip.
- Open Adjust price after extending: field shows 210.00; change minutes to 45 and it moves to 240.00 on its own.
- Type 200 by hand, change minutes: field stays 200, Recalculate link offers the computed value; total charges $200 once, not $200 + $60.
- Reopen the completed appointment: duration and extended-time minutes come back without doubling.
