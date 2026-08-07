# Café Drink Customization Upgrade

Make the customize screen for Coffee & Lattes (and Matcha) complete: hot/iced, a sweetness meter, syrup flavors with sugar-free options, and a special-instructions note.

## What's there today

The Coffee & Lattes and Matcha categories already have option groups saved in the menu database:

- Temperature: Iced, Hot (required, pick one)
- Sweetness: Unsweetened, Light, Regular, Extra (required, pick one)
- Milk: Whole, 2%, Almond, Oat (required, pick one)
- Add-ons: extra espresso shot, extra matcha

So hot/cold and sweetness exist as data but read as a plain grid of buttons buried below Milk — they don't look like a temperature toggle or a sweetness meter, which is why they're easy to miss. The fix is presentation plus the missing syrup and notes pieces.

## Changes

### 1. Temperature front and center
Show Temperature first in the customize dialog as two large side-by-side Hot / Iced buttons with icons, always visible without scrolling.

### 2. Sweetness meter
Replace the four sweetness buttons with a 4-stop slider/segmented meter labeled: None - Light - Regular - Extra. Defaults to Regular. Same underlying options, new control.

### 3. Syrup flavors (new option group)
Add a "Syrup" group to Coffee & Lattes and Matcha. Each flavor can be picked as Regular or Sugar-Free where a sugar-free version exists:

- No Syrup (default)
- Vanilla - Regular / Sugar-Free
- Hazelnut - Regular / Sugar-Free
- Brown Sugar - Regular
- Honey - Regular
- Maple - Regular
- Chocolate - Regular / Sugar-Free

Presented as flavor tiles; picking a flavor reveals a Regular / Sugar-Free toggle for flavors that offer both. Pricing: all syrups $0 by default, and each syrup is editable (name, price, sugar-free availability, active on/off) in Café Menu Management like the other add-ons.

### 4. Special instructions
Add a "Special instructions" text box (max 200 characters) at the bottom of the customize dialog, with this exact note under it:

> Tell us about allergies, sensitivities, or how you'd like it made. We'll do our best — but we can't guarantee every request can be accommodated, and we can't rule out cross-contact in a shared café space.

The note travels with the item into the cart, onto the order shown to café staff and the kiosk/POS ticket, and appears in the item line so nothing gets missed.

### 5. Order display
Cart lines and staff order tickets show the choices in a readable form, e.g.
`Latte - Iced, Regular sweet, Oat Milk, Vanilla (Sugar-Free) - Note: extra hot, no foam`

## Technical notes

- Syrups are inserted as `cafe_menu_addons` rows on the Coffee & Lattes and Matcha categories, `group_name = 'Syrup'`, `selection_type = 'single'`, not required; sugar-free variants stored as separate rows (e.g. "Vanilla (Sugar-Free)") so existing admin management and pricing work unchanged.
- `CafeAddonDialog.tsx`: custom renderers per group (Temperature toggle, Sweetness meter, Syrup tiles + SF toggle), fixed group order Temperature → Sweetness → Milk → Syrup → Add-ons, plus the notes textarea.
- Cart item gains an optional `note` string; included in `order_items` JSON on `cafe_orders` (no schema change needed) and rendered in the café POS/kiosk order queue.
