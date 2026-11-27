# Fix unclear wording in the two Seasonal Edit promo drafts

## What changes
- In both draft emails (members and non-members), replace "something they can put on their calendar" with "Book a class, a massage, or a personal training session."
- Reread both emails line by line and rewrite any other vague phrases in plain, specific words (what the offer is, the price, how to book).
- Keep sold-out notes accurate (80 and 10 packs sold out for everyone; 30 pack sold out for non-members only).
- No member pricing on gifts for others; no "sale", "free", or processing-fee wording.

## After the edit
- Render fresh previews of both emails and show them to you before anything goes out.
- Nothing is sent until you approve the final wording and say when to send.

## Technical details
- Update `blocks`/subject/preheader on campaign drafts `dcb7084e-7858-40ce-bcb3-066c0d69de15` (members) and `d53c8d1d-8135-4bbc-8695-8bf85a93b5a2` (non-members) in `marketing_campaigns`; status stays draft.
- Preview by rendering with `_shared/campaignRender.ts` and saving screenshots to /mnt/documents.
