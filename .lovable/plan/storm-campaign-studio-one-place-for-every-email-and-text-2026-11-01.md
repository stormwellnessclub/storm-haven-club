# Storm Campaign Studio — one place for every email and text

## The problem today
- Every announcement (Higher Self Society, sound bath, harvest moon, hours changes, outages, presales) was built as its own panel or its own sending function. There are 8+ one-off "blast" senders and many separate tabs.
- Result: you can't find a send, can't see what's scheduled, and every new email needs new building.
- Naming: the public name is always **Higher Self Society**. "Book club" stays internal only.

## What top marketing teams use (and what we borrow)
| System | What it does best | What Storm borrows |
|---|---|---|
| Klaviyo | Audiences built from behavior, automated flows, revenue tied to each email | Smart audiences from real club activity; results per campaign |
| Customer.io / Braze | Visual journeys: "if they open, then…; if not, text in 2 days" | Simple step-by-step funnels across email + text |
| Mailchimp / Beehiiv | Drag-and-drop branded templates, AI subject lines | Brand-locked design blocks, AI writing help |
| HubSpot | One calendar of everything scheduled | A campaign calendar |

The pattern they share: **one composer, one audience builder, one calendar, one results screen** — events plug into it rather than each having their own sender.

## The plan: one "Campaign Studio" in Admin → Marketing

### 1. One inbox of every campaign
A single list: Drafts, Scheduled, Sent — email and text together. Filter by event (Higher Self Society, Spa, Classes, Kids Care…). Event pages simply show a "Campaigns for this event" link instead of their own send panels.

### 2. One composer with brand-locked design
- Build an email from blocks: header image, book/product cover, headline, text, button, event details, photo grid, signature.
- Colors, fonts, logo and sign-off locked to your Storm brand (brown, cream, beige, burgundy, gold; no emojis; your voice rules).
- Upload your own photos/covers — no stock or AI imagery.
- Live phone + desktop preview, and "send me a test" right there.
- Text version written alongside, with optional picture.

### 3. AI marketing assistant inside the composer
- "Write this for me": you describe the goal in a sentence; it drafts subject, preview line, email and matching text in your brand voice, checking banned words ("free", etc.).
- Offers 3 subject-line options and a shorter/warmer/more premium rewrite.
- Campaign idea generator: suggests seasonal and behavior-based ideas (e.g., members who haven't visited the wet spa in 30 days).

### 4. Smart audiences (saved, reusable)
Pick from ready audiences or build your own: Higher Self Society roster, active members, frozen members, non-members who bought a class pass, spa clients, lapsed visitors, RSVP'd yes / no reply, etc. Cancelled members are never included in member audiences. Unsubscribes and text opt-outs are always respected automatically.

### 5. Funnels (journeys)
Simple step lists, no flowchart complexity to start:
- Example: Announcement email → 2 days later text to those who didn't open → reminder 1 day before the meeting to RSVP'd "Yes".
- Ready-made funnels: event RSVP, new non-member welcome, class-pass → membership, spa first visit → rebook, lapsed member win-back.

### 6. Calendar + results
- Calendar showing every scheduled email and text.
- Results per campaign: delivered, opened, clicked, unsubscribed, and bookings/sales that followed within 14 days.

## Rollout (step by step, nothing sent without you)
1. **Phase 1 — Foundation:** Campaign list, composer with brand blocks, test send, scheduling, calendar. Move the Higher Self Society announcement and RSVP reminder into it first so you can see them.
2. **Phase 2 — AI assistant + saved audiences.**
3. **Phase 3 — Funnels and results reporting.**
4. **Phase 4 — Retire the old one-off panels** after each is moved over.

## Right now (before 7:00 AM today)
The Higher Self Society winning-book email and text were set to go out at 7:00 AM Michigan time. As part of approving this plan, I'll first confirm whether they're still scheduled and show you exactly where, and let you pause them if you want to review first.

## Technical details
- New tables: campaigns (channel, status, schedule, design JSON, audience ref), campaign_audiences (saved filters), campaign_journeys/steps; reuse email_campaigns / email_campaign_recipients / sms_campaigns where possible.
- All email sends through `_shared/marketingEmail.ts` with one-click unsubscribe; all texts through `send-sms` with consent; recipient lists paginated and de-duplicated by lowercase email.
- Scheduling uses one-time database timers per send (no polling); jobs authenticate with the vault-held internal token.
- AI drafting via Lovable AI with the brand-voice memory as system rules and banned-word check.
- Results attribution from `revenue_ledger` only.
