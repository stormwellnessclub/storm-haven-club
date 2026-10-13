# Body Roller campaign rewrite and journal article

## 1. Use the full name everywhere
- Email header: change the "STORM" wordmark to "STORM WELLNESS CLUB".
- Change every mention of plain "Storm" in the email copy, subject lines and preview text to "Storm Wellness Club". Check the presale page and the front desk page the same way.

## 2. Rewrite all seven emails (member and non-member: launch, halfway, last chance, plus the "it has arrived" email)
- Tone: quiet, sensory and confident, like a high-end spa. Short lines, specific details, no filler, no exclamation marks, no stacked adjectives, and none of the stock lines like "Roll. Glow. Release."
- Each email focuses on one or two benefits instead of listing all of them:
  - **Launch:** what the session feels like (warm wooden rollers moving in a slow wave, with red light underneath). Benefits: lighter, less puffy legs and support for lymph flow.
  - **Halfway:** recovery. Benefits: loosens tight muscles after training, better circulation, more energy.
  - **Last chance:** smoother, firmer-looking skin and support for body-shaping goals, plus the presale deadline.
  - **Arrived:** a short ritual with three steps (book, arrive, roll) and how to get the most from the first session.
- Non-member versions keep the same story with their own prices. Wording stays "reserve early", never "free".
- Health wording is careful: "supports", "helps reduce the look of", "many guests feel". No claims about detox results, curing or guarantees.
- Keep what's already in place: the animated machine loop, the current prices (member 60-minute 10-pack $500 with $800 crossed out), the six-month expiry and the presale end date. Emails don't mention tax or the card fee.
- When your own email designs arrive, they replace these.

## 3. Journal article that leads to the presale
- New public page: "What a Lymphatic Body Roller Session Does for Your Body".
- It covers all six benefits in polished, careful wording, uses your real machine photos and the video loop, and ends with a "Reserve presale pricing" button that opens the presale page.
- Add a link to it from the presale page ("Read about the ritual") and from the Body Roller listing on the Spa page.
- Each email gets a small "Read more" link to the article.
- The page gets its own search title and description.

## 4. Review before anything is sent
- You'll get a preview of each email in Admin → Marketing → Body Roller Presale so you can approve the wording. Nothing is sent to members or non-members.

## Technical details
- Email templates: `supabase/functions/_shared/bodyRollerPresale.ts` (header in `shell()`, body copy in `buildPresaleEmail`); subject lines in `send-body-roller-presale-email`. Redeploy both email functions.
- New route `/journal/lymphatic-body-roller` (page in `src/pages/`), registered in the router and added to the sitemap/prerender list if one exists.
- Benefit copy lives in one shared constant so the emails and the article stay in sync.
