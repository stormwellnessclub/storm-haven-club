# Storm Wellness Club: Art Direction Redesign (Phases 1–3)

This follows your Digital Art Direction Directive. The Messaging Directive stays in force. I'll rebuild the homepage's composition, not just restyle it, and stop for your approval before touching any other page.

## Phase 1: Visual audit (delivered to you as a document)
I'll screenshot every public page on phone and desktop and run your three tests on each: Visit Desire, Blurred Screenshot and Physical-Digital Parity. Every issue is written as **current state → why it weakens the brand → proposed direction**.

Issues I already expect to find:
- The homepage runs on cards: quick-link cards, three studio cards and three spa cards.
- Icons stand in for real rooms (sauna, steam, plunge).
- Many sections repeat the same centered heading, paragraph and button pattern.
- Rounded boxes, gold buttons and a pulsing final button.
- Photos are held at small sizes.

## Phase 2: Public design system (website only; member portal and checkout stay as they are)
- **Type:** keep your current serif and sans fonts. Very large statements, small captions, tiny supporting text, and fewer weights.
- **Space:** much more empty space, with a different pace per chapter (tighter for Move, slower for Recover and Spa).
- **Images:** a few set shapes (full-screen, full-width break, two-thirds beside text, tall portrait, detail crop), with square edges, no shadows and a consistent warm grade.
- **Structure:** thin lines and proportion instead of boxes. Cards only where they actually help, like schedules and checkout.
- **Buttons and links:** one quiet main button style, with underlined text links for everything else. No glow, gradient or pulse.
- **Motion:** slow image reveals and gentle fades only, and they never delay content.
- **Captions:** small numbered labels (01 Arrival, 02 The Idea…) and room captions such as "Himalayan Salt Room — Level 1".
- **Phone:** designed separately so images stay large and type keeps its scale, instead of just stacking.

## Phase 3: Homepage rebuilt as a walk through the club
1. **Arrival:** a full-screen lobby photo, one short statement and one action. Nothing else.
2. **The Idea:** a large statement with two or three lines of copy, set off-center beside a tall photo.
3. **Move:** Reformer, cycling and the training floor as a chapter. One dominant photo with smaller ones beside it, tighter rhythm and short captions.
4. **Recover:** the pace slows. A full-width salt room or steam image, then sauna, plunge, red light and ZeroBody as a photo sequence with one-line captions. No icons.
5. **Spa Aella:** a quiet, warm, more spacious section. One large treatment-room image and a short sensory paragraph, then a single link into the menu.
6. **Nourish:** a café image and two lines of copy.
7. **Life inside Storm Wellness:** a horizontal strip of people-in-space photos, plus one real member review set large in type and attributed to the member.
8. **Membership:** a calm closing invitation into the tiers, with Kids Care as a line inside it.

The section order you set earlier is preserved and reframed as chapters.

## What I need from you
- **Photos:** I'll use only real club photos (no stock or AI images). I have the lobby, studios, salt room, sauna, steam, ZeroBody, red light, spa rooms and café. People-in-space shots and any short videos (steam, coffee pour, reformer movement) would make the biggest difference. Until you send them, I'll build with what we have and mark where video would go.
- **Navigation:** I'll propose Club · Move · Recover · Spa Aella · Café · Membership on the existing addresses so search rankings aren't affected. You approve before it changes.

## After Phase 3
I stop and send you homepage screenshots. Only after you approve do Memberships, Classes, Recovery, Spa, PT, Café, Events and About get the same system.

## Technical details
- I'll save the Art Direction Directive to project memory as a standing rule.
- New public building blocks (chapter section, full-bleed image, split editorial, caption, quiet link, pull quote, photo strip) live in a public-site folder, and design tokens are added to index.css. The portal and admin components stay untouched.
- Index.tsx gets rebuilt from these blocks. SEO tags, headings and URLs are kept.
- I'll check phone (402px and 564px) and desktop screenshots, including blurred-copy versions for the screenshot test.
