# Fix: Latte orders showing two milks on ticket

## Root cause

The Coffee & Lattes category has a proper **Milk** group (single-select, required, free): Whole, 2%, Almond, Oat — the customer can freely swap between them.

But the same category **also** has paid duplicates sitting in the generic **Add-ons** group (multi-select):
- `oat milk` — +$0.75
- `almond milk` — +$1.00

When a customer picks "Oat Milk" from the Milk group and *also* taps the "oat milk +$0.75" chip in Add-ons (easy to do — it looks like the only way to get oat milk), the order sticker prints **two milks** and they're charged an extra $0.75–$1. This is exactly the "two milks on the ticket" issue.

The Milk selector itself is already working correctly — it's a single-select radio, so customers can switch off Whole Milk. The Whole Milk default just happens to be the first `is_required` option; that's standard and can stay.

## Change

Data-only fix in `cafe_menu_addons` (Coffee & Lattes category, `ab6e378d-…`):

1. Deactivate the duplicate milk entries in the Add-ons group:
   - `oat milk` (`311c16d7-…`) → `is_active = false`
   - `almond milk` (`083e797d-…`) → `is_active = false`

   Deactivate rather than delete so any historical orders referencing them stay intact.

2. Leave the free **Milk** group (Whole / 2% / Almond / Oat) as-is — it already lets customers swap milks at no charge with a single selection.

3. Leave `extra shot espresso` and `extra matcha` in the Add-ons group untouched.

No frontend code changes needed — `CafeAddonDialog` already renders the Milk group as a single-select radio, so once the duplicates are gone, only one milk can ever land on the ticket.

## Verification

- Open a Latte in the café order UI → **Milk** section shows Whole/2%/Almond/Oat, tapping any one swaps the choice (no double-add).
- Add-ons section no longer lists "oat milk" or "almond milk".
- Placing an order with Oat Milk selected produces a ticket with exactly one milk line.
