# Remove class photos on the Seasonal Edit page (phones)

## What changes
On the Seasonal Edit page, after the PT offers, the class section currently shows:
- one large studio photo before the class offers
- a photo beside each class offer (Discovery Pass, Movement Edit, Club Experience)

On phones, all of these photos will be removed so people go straight from the PT offers to the class offers and their prices and buttons.

On computers, the photos stay as they are (scrolling isn't an issue there). If you'd rather remove them on computers too, say so and I'll remove them everywhere.

Nothing else changes: wording, prices, "Give as a gift" buttons, the PT section and its photo stay the same.

## Technical details
- `src/components/seasonal/MovementEditSection.tsx`: add `hidden md:block` to the studio banner section and to each offer's photo column, so they only render from tablet width up.
