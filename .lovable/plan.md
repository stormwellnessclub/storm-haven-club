# Membership page: second pass

## Remove
- Opening text: "Membership" label, "A quieter way to be well." and the line under it. The opening becomes the stairway photo with one "Apply for invitation" button.
- "Always yours", "The house, in full." and the paragraph beside it. The photo grid stays.
- The whole Founding Members section at the bottom.

## Add photos: Red Light and Starpool ZeroBody
- **Red Light:** the photo of the woman stretching in front of the red panel. It's moody and human, and it matches the warm, dark feel of the other photos.
- **ZeroBody:** the arched-door photo of the two ZeroBody beds in the marble room. It's your actual room, and the arch echoes the stairway photo.
- Not used: the two close-ups of red LEDs and the blue ZeroBody control panel. They look like product or catalog shots next to real photos of the club.
- The grid gets two more tiles, and the layout is rebalanced so all seven photos sit evenly.

## New amenity lines (confident, factual, no poetry)
- Himalayan Salt Room: Walls of hand-cut Himalayan salt. Sit, breathe, reset.
- Steam Room: Gold mosaic and eucalyptus steam. Open the lungs, clear the head.
- Sauna: Cedar, high heat, deep sweat. The oldest recovery ritual there is.
- Cold Plunge: Held cold, on your terms. The fastest way back to clarity.
- Dry Cryo Bed: Minus temperatures in minutes, fully dressed. Built for inflammation and recovery.
- Red Light Therapy: Clinical-grade red and near-infrared panels, full body.
- Starpool ZeroBody: Italian dry float. Weightless, warm and completely still.

## Tiers
- Heading stays "Four ways to belong." The line under it becomes: "Every membership is a one-year commitment, billed monthly. A $300 annual fee applies to every tier."
- Each tier card shows under the price, in plain view:
  - $X / month
  - 12-month commitment
  - $300 annual fee
- The "Enquire" button becomes **Apply for invitation** on every tier.

## Please confirm
- That the commitment is 12 months billed monthly for every tier. I'll write it exactly as stated above unless you correct it.

## Technical details
- Only `src/pages/Memberships.tsx` changes: remove the hero text block, intro block and founding section; update the amenity array and tier card markup; add two mosaic tiles.
- The two photos are resized to about 1600px WebP with light touch-ups only (no AI edits) and uploaded as CDN assets.
- The search title, description and FAQ stay factual. The FAQ gets the 12-month commitment.
