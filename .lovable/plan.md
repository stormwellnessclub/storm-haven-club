# Make the homepage words look and read premium

Right now the text reads like a paragraph that was dropped onto the page. On a premium site, the words are designed: they're short, they have room to breathe, they're clearly ranked, and they sit on a deliberate rhythm. This plan changes how the words are laid out and edited. The meaning, photos and section order stay the same.

## What changes

**1. Shorter, quieter lines**
- The hero line under the photo goes from a 30-word sentence to one short line of about 8 to 12 words, for example: "Training, recovery and care — part of how you live." The longer idea moves further down the page.
- Section intros are cut to one or two short sentences. Nothing runs longer than about 60 characters per line.

**2. A clear hierarchy in every section**
- **Eyebrow:** a small, widely spaced, all-caps label (e.g. RECOVERY, SPA AELLA, THE CAFÉ) in the gold accent.
- **Headline:** large serif with tight line spacing, broken by hand so lines never end on a single orphan word ("to." on its own will no longer happen).
- **Body:** small, lighter weight, narrow column, generous line height.
- **Action:** one understated text link with a thin underline and arrow instead of several heavy boxed buttons. The hero keeps its main "Explore Memberships" button.

**3. More space and restraint**
- More empty space above and below headlines, and fewer elements competing in each section.
- Amenity lists in the recovery section become a quiet two-column list with thin dividers instead of icon rows with long descriptions.
- Less of the soft pulsing and hover motion on the final button.

**4. Editorial moments**
- One short pull-quote line between sections (e.g. "Progress is not only what happens while you train."), set in large italic serif with plenty of space around it.

**5. Phone first**
- Every headline is checked at your phone width so lines break cleanly and nothing wraps awkwardly.

## Scope
- Homepage only first, so you can approve the look. Then the same style goes to Memberships, Classes, Personal Training, Spa and Café.

## Technical details
- I'll add shared text styles (eyebrow, display headline, editorial body, quiet link) to the design system and use them in Index.tsx and the homepage sections. Copy will be tightened in place.
- The hero text block gets a max width set in characters, and its headlines get balanced line wrapping.
- I'll verify with phone (402px and 564px) and desktop screenshots before and after.
