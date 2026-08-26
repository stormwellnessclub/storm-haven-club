# Update the public phone number to (248) 232-8487

The site currently shows **(313) 286-5070** in every public contact spot. The main navigation bar itself doesn't display a phone number, so the number you're seeing most likely comes from the footer contact block or the Google search listing data. I'll replace it everywhere on the public site.

## What changes

Visible phone number, updated to (248) 232-8487:
- Footer contact block
- Guest Pass page contact line
- FAQ page "call us" link
- Privacy policy contact section
- Terms of service (two places)

Search-engine / structured data (this is what Google and Apple Maps read):
- `index.html` business schema (3 occurrences)
- `src/lib/seo/business.ts` business profile telephone

## Technical notes

- Display format: `(248) 232-8487`; link format: `tel:+12482328487`; schema format: `+1-248-232-8487`.
- Signed-out member screen `ApplicationUnderReview.tsx` has a leftover placeholder number `(713) 555-1234` — I'll fix that to the real number too unless you'd rather it point somewhere else.
- Not touched: PDF agreements in `public/agreements/` (static files that would need regenerating) and any phone numbers stored in the database or SMS settings. Tell me if those need updating as well.
