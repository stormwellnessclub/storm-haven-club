# Seasonal Edit page: tabs at the top + clearer massage note

## What changes
1. **Tab bar near the top of the page** (right after the Members / Non-members choice). Tabs:
   - Personal Training
   - Classes
   - Massages
   - **Buy a gift** (goes to the gift shop, Gift Cards section)
   Tapping a section tab scrolls smoothly down to that offer. The bar stays pinned to the top of the screen while scrolling, so people can jump between offers without scrolling back up. The tab for the section on screen is highlighted. Works on phones (tabs scroll sideways if they don't fit).
2. **Massage note fixed.** The massage section's line "For yourself, or for someone who deserves an hour that is entirely theirs" stays, and right under it, members only see a clear line: "Member pricing: your tier discount applies (Silver 5%, Gold 8%, Platinum 10%, Diamond 12%). Non-members pay the listed price." Non-members never see the member discount wording.
3. The old small "Jump to an offer" links (Personal Training, Classes) are replaced by the new tab bar. Nothing else on the page is removed or reworded.

## Not changing
Prices, offers, checkout, gift shop, end date (Nov 30).

## Technical details
- `src/pages/BlackFriday.tsx`: replace the jump-link nav with a sticky horizontal tab bar (`#pt-edit`, `#movement-edit`, `#spa-edit`, and a link to `/shop#gift-cards`); active tab via IntersectionObserver; adjust `scroll-mt` so headings aren't hidden under the bar.
- `src/components/seasonal/SpaEditSection.tsx`: show the members-only tier line whenever the member view is selected (also when tier rate is known), never in the non-member view.
- Verify on phone and desktop with Playwright. Publish needed for live site.
