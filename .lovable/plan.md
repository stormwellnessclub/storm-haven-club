# Add the Moroccan Clay Wrap, plus red light and vibration before longer wraps

## 1. New treatment: Moroccan Clay Wrap
- **60 minutes, $170** and **90 minutes, $225**. On the menu it shows as one listing where guests pick the length, like the Seaweed Ritual.
- Booked with **Teresa in Room 6**, on the same days and hours as your other wraps. Guests book it online themselves with the same waiver, card and wrap intake form as the other wraps.
- **Steps:** full-body exfoliation, the same as your other wraps, then a shower. Next comes warm Moroccan rhassoul clay from the Atlas Mountains, a cocooned rest, a rinse, and a nourishing finish (argan-style oil or body butter). The 90-minute option adds a longer closing massage.
- **Wording:** benefit-led, like the Seaweed Ritual, with no warnings or "not proven" lines. Benefits include purified, refined skin, softness and smoothness, a mineral-rich glow and deep relaxation.
- It gets its own **Learn more** page.

## 2. Red light and vibration plate before every longer wrap
When a guest books the longer option of a wrap, the booking and the wrap's page will say the visit includes a vibration plate session and a red light session before the treatment. This time is extra, on top of the treatment length, so they should arrive 20–30 minutes early. This is the same wording the Seaweed Ritual uses now.
- **Applies to:** Moroccan Clay 90 min and Anti-Aging Collagen 90 min (extended).
- **Seaweed:** stays as it is today, with prep before both lengths.
- **Not included:** Vitamin C, Mud and Body Sculpting come in one length only, so they don't have a longer option. Tell me if you want the prep sessions on those too.
- Booking doesn't hold extra time on Teresa's schedule for the prep sessions. Guests arrive early and use the recovery rooms first, the same as with Seaweed now.

## Not changing
Other wrap prices, Fire & Ice, booking rules.

## Technical
- Add two `spa_services` rows (category Body Wraps): "Moroccan Clay Wrap" 60/$170 and "Moroccan Clay Wrap (Extended)" 90/$225, assigned to Teresa and Room 6, copying the availability windows and booking settings of the Mud Therapy Wrap. Existing grouping via `bodyWrapName` merges them into one menu row.
- Add a `moroccan-clay` entry to `BODY_WRAP_DETAILS` (overview, body, benefits, faqs, durations 60/90). Learn more works automatically.
- Add a shared prep note for extended wraps: show `SEAWEED_RITUAL_PREPARATION`-style text in the menu row and the booking modal when the selected wrap variant is "(Extended)". Mention it in the details copy for Collagen and Moroccan Clay.
- Save memory: Moroccan Clay prices and the rule that longer wraps include red light and vibration first.
