# Membership page: rewrite the copy in an Aman / Remedy Place voice

## The voice
- Sensory and calm. Describe how the club feels: warmth, stillness, light, the quiet after the cold plunge.
- Few words, lots of space. Short lines. No exclamation marks, no "transform", "ultimate", "luxury", "elite", "limited", "journey", "free".
- The page invites people in. It doesn't push. Prices sit quietly on the page, with no urgency.
- Feature lists become gentle descriptions ("Red light, four evenings a month"), not checkmark bullet points.

## Proposed wording, section by section

**Opening**
- Small label: Membership
- Heading: A quieter way to be well.
- Line: Heat, cold, movement and rest, held in one circular house in Livonia. Membership is how you come back to it.
- Buttons: Request an invitation · View the tiers

**What every member has** (next to the photo mosaic)
- Label: Always yours
- Heading: The house, in full.
- Line: The gym floor at first light. Cedar heat, then steam, then the salt room. The cold plunge, and the stillness after. Member pricing in the spa, whenever you need more.
- The six bullet points become that one paragraph.

**The tiers**
- Label: Membership
- Heading: Four ways to belong.
- Line: Each tier deepens your recovery. A $300 annual fee applies to every tier.
- Tier names stay: Silver, Gold, Platinum, Diamond. Each gets one line about how it feels instead of a slogan:
  - Silver: The house, the heat, the cold.
  - Gold: Silver, with light and cold therapy woven into your month.
  - Platinum: More time under the light. More recovery.
  - Diamond: The full rhythm: classes, recovery and first access to every gathering.
- Inclusions are written as short phrases without checkmarks, for example: "Red light therapy, four sessions a month".
- Button on each tier: Enquire (no "Apply for Invitation").

**Founding members**
- Label: Founding members
- Heading: Those who were here first.
- Line: Founding members pay annually and are with us from the beginning. They carry a founding card and club pieces, and they are first to every private evening.
- Button: Enquire about founding membership (no pulsing effect)

**Closing**
- Heading: Come and see the house.
- Line: Membership is by application. We will be in touch within two days to arrange a quiet visit.
- Button: Request an invitation

## Also
- The heading, labels and body keep the current fonts and colours. Only the words change, plus a few layout touches: more space between sections and a lighter, simpler tier list.
- The questions at the bottom stay factual, but I'll soften their tone.
- The Google search title and description stay factual so the page can still be found in search.

## Your new photos
- **Opening photo:** the stairway down through the arch toward the glowing salt room. It feels like arriving, which suits "A quieter way to be well."
- **Photo mosaic ("The house, in full"):**
  - Salt room: the close-up of the glowing salt wall with the wooden bench.
  - Steam room: the gold mosaic room with the lit stone panel.
  - Sauna: the cedar room.
  - Gym: the view over the gym floor from above.
  - Wet spa lounge: the slatted-ceiling corridor with towels and the arched mirror.
- **Not used:** the second salt-room doorway shot, since the close-up is stronger. The old photos these replace are removed from the page.
- **Retouching:** these are touch-ups only, never AI changes, so every room stays exactly as it really is.
  - Steam room: brighten the shadows, reduce grain, and sharpen the tiles and the lit panel.
  - Salt room: even out the glow and sharpen it.
  - Sauna: remove the purple cast from the lights so the cedar looks warm and natural.
  - Every photo is saved sharp at full size and kept small enough to load quickly.

## Technical details
- Photos are retouched with standard image tools (Python/PIL: levels, white balance, denoise, unsharp mask), exported as WebP/JPEG at about 1600px, and uploaded as CDN assets.
- Only `src/pages/Memberships.tsx` is edited: copy strings, tier taglines/features, removing checkmark icons from tier lists, and wider section spacing.
- No pricing, links or application flow changes.
