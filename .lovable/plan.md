# Spa Aella mockup: private preview page

A hidden page at `/spa/preview` (not linked, not indexed). The live spa page, menu, prices and booking stay exactly as they are until you approve.

## The feeling
Dark, warm and low-lit: espresso and near-black backgrounds, cream text, warm skin tones in the photos, thin lines in place of boxes. Slow fades only. One or two short lines per moment, using your saved Spa Aella wording and none of the banned phrases.

## The visit, in order (each step answers a question for the visitor)
1. **Arrival.** A full-screen dark photo: hands, warm skin, low light. "SPA AELLA" in small letters, then "The part of wellness you shouldn't have to earn." Two quiet buttons: Explore Treatments and View Availability.
2. **Why Aella.** One sentence on dark space: "You should not have to be exhausted before you decide your body deserves care."
3. **What do you need today?** Four large photo panels you can tap: Massage & Bodywork, Facials, Body Treatments, Recovery. Each one jumps straight to its part of the menu.
4. **Pause.** One full-width image with no text and no button, so the page can breathe.
5. **Signature.** Only the treatments that really are on the live menu, such as the Seaweed Ritual and the Storm Signature Massage, shown large, one at a time.
6. **Treatment chapters.** Massage, Facials, Body Treatments, Recovery. Each chapter has its own image, a short line, and real menu rows with name, one-line experience, length, price, View Treatment and Book. The rows read your live menu, so prices are always correct.
7. **The space.** Real Storm photos (treatment room, hallway, showers, salt room) in an uneven editorial grid.
8. **Open to you.** Says calmly that you don't need a membership.
9. **Find your time.** One last dark band with View Availability.

## Booking
On the preview page, Book opens your current booking window with no changes, so nothing can break. Once you approve the look, I'll restyle that window to match: dark, "Let's find your time", a "You're booking" summary, "First available" therapist, and a "You're booked." confirmation.

## Photos
- Your 8 inspiration images are stand-ins for the mockup only. I'll crop and darken them where needed, and won't use the website screenshots as photos.
- I'll use real Storm photos for the space, and make a few to fill gaps (stones, towels, warm light) in the same tone.
- Every stand-in gets replaced with your real photos before anything goes live.

## Mobile first
Designed for your phone first: full-height photos, large type, and Book always within one tap of each treatment.

## Technical notes
- New `src/pages/SpaPreview.tsx` plus route `/spa/preview`, with `noindex`, kept out of the sitemap and the menu.
- Uses the existing `useSpaServices`, the massage/wrap/seaweed grouping helpers and `SpaBookingModal`. No backend, price or booking changes.
- Stand-in images are uploaded with lovable-assets. Dark tokens are added to the design system, so colors aren't hard-coded.
- I'll check it in a phone-sized browser, and test that Book opens with the correct treatment.
