# Public Events & Member Rituals — corrections status and remaining work

## Already applied (live now on /events and /rituals)

- **/events**: heading "Events at Storm Wellness Club" with your introduction verbatim. The "healing circles, sound baths" line, the "Members also have…" sentence and the "Looking for something weekly instead?" links are gone. Two distinct pathway panels added below the introduction — Public Experiences (filters the calendar) and Member Rituals (leads to /rituals).
- **/rituals**: hero rewritten to your copy verbatim, including "Community, thoughtfully cultivated." and the eligibility line. Buttons are now "Explore the Ritual Calendar" and "Sign In to Your Member Portal".
- **Collections**: all seven rewritten with your copy; the repeated "What to expect" block removed. Renamed to Cinema at Storm Wellness Club and The Storm Wellness Club Supper Club. Supper Club shows "reserved for Founding & Diamond Members" instead of a members-only label.
- **Composition**: varied editorial rhythm — one wide featured treatment, alternating left/right sections, two quiet centered typography-only sections.
- **Imagery**: all seven previously generated collection images deleted. No AI-generated imagery remains on either page. Collections currently use typography-and-colour compositions in the club's tones.
- **Preserved**: routes, event data, filters, grid/month calendar, detail overlay, deep links, eligibility rules, booking logic — untouched.

## Remaining work

### 1. Real collection photography
Nothing in the project is authentic photography of a book discussion, film screening, salon, health talk, restorative session, supper table or seasonal ritual. Rather than substitute stock or invented imagery, each collection stays typography-led until you supply photos.

When you send photos, for each collection I will:
- Upload them into the existing event image storage.
- Set each collection's image so the section switches automatically from the typography composition to the photograph.
- Keep the varied layout rhythm so the page does not become seven identical image blocks.

If you'd rather I source properly licensed editorial photography instead of waiting, say so and I'll propose specific images for your approval before placing any of them.

### 2. Naming flagged for your decision
"The Storm Book Society" shortens the business name to "Storm". Left unchanged as instructed. Options: keep as the approved official series name, or rename (for example "The Storm Wellness Club Book Society").

### 3. Small polish items found while reviewing
- The filter row on /events overflows slightly on narrow phones; make it scroll cleanly.
- The Ritual Calendar page still opens with "Gatherings held through the season for members of Storm Wellness Club" — same seasonal phrasing you asked to move away from. Suggested replacement: "Upcoming Member Rituals. Access and availability vary by event and membership tier."

## Technical notes

- Collection copy lives in the `ritual_collections` table; the two renames and the Supper Club eligibility note are data updates already applied there.
- The typography composition is a small presentational component that yields to a real photo the moment `image_url` is set — no code change needed per photo.
- No event, ticket, waitlist or eligibility logic is touched by any remaining item.
- Member portal and admin Events Portal work stays paused until you approve these public pages.
