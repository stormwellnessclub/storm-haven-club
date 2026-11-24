# Fix the round 3 member flyers and the blurry text image

## What's wrong
1. **Member massage flyer:** it shows a crossed-out price and then "Member pricing" with no explanation, so a member can't tell what they actually pay.
2. **The second (long) text image:** I put the PT and massage flyers side by side in one big picture. Phone carriers shrink pictures in texts, so the words get too small and blurry to read.

## The fix

### 1. Clearer member massage flyer (dark brown, logo and texture only)
- Show each massage at its Seasonal Edit price, with no crossed-out price.
- Add one plain line under the prices: "Members: your tier discount comes off at checkout: Silver 5%, Gold 8%, Platinum 10%, Diamond 12%."
- Keep the rest the same: "Through November 30", "Available in limited quantities". No processing-fee wording and no "each gift covers the full massage" line.
- The non-member massage flyer stays as it is.

### 2. No more combined image in texts
- Each text sends **one flyer only**, sized to show clearly on a phone after the carrier shrinks it. The flyer is tall, with large type.
  - Members text: the new member massage flyer, with PT mentioned in the message wording and the link.
  - Non-members text: the non-member massage flyer, with PT the same way.
- Or, if you prefer, each audience gets two separate flyers (PT, then massage) attached to one text. That's the question below.
- I'll check each picture at text-message size before showing it to you, so it's readable.

### 3. Update the saved drafts
- Swap the new pictures into the six round 3 drafts in Campaign Studio (members, non-members and email list, for both text and email). Emails use the separate PT and massage pictures, not the combined one.
- Show you previews of everything again. Nothing gets sent or scheduled until you pick a send time.

## Technical details
- Regenerate the member massage flyer PNGs (story + square) with the real logo and paper texture. Re-export the text image at about 1080 wide, under 600 KB as JPEG, and check legibility at a 640 px downscale.
- Upload as lovable-assets and update the `marketing_campaigns` draft image references. Drafts stay status draft.
