# Homepage refinement: stairs photo, captions and language

## 1. Clean the marble stair photo
- Retouch the existing photo only (no new or AI-generated scene): remove the exposed wire under the step, tidy small distractions (scuffs, stray cables, outlets), keep the real marble, light and composition untouched.
- Save as a cleaned version and swap it in; keep the original file as a backup.
- Show you a before/after before it goes live.

## 2. Remove captions that state the obvious
- Delete "The marble stair" under the stairs photo — the image speaks for itself.
- Apply the same rule everywhere: no caption that just names what's in the picture ("Cycle Studio", "The training floor", "Spa Aella"). Captions stay only where they add something a visitor can't see.

## 3. Rewrite the homepage language
Replace the flat, descriptive lines (e.g. "Reformer Pilates — eight people, one instructor watching your form") with fewer, stronger lines written to the messaging directive: identity first, then outcome, then experience. Short, confident, restrained — no explaining, no counting features, no avoid-list words.

Direction for each chapter (final wording shown to you before publishing):
- Arrival: one line that feels like a place, not a pitch.
- The Idea: keep "Training, recovery and care no longer live in separate places" (you approved it), tighten the paragraph under it.
- Move: drop the "eight people" spec line; one line about the feeling of being coached well, small classes implied, not listed.
- Recover: keep the stimulus/adaptation idea, cut it to one sentence.
- Spa Aella, Nourish, Life Inside, Membership: shorten each to a headline plus at most one supporting sentence.

## 4. Review
- Check phone and desktop screenshots; send you the full copy list side by side (old vs new) so you can approve or rewrite lines.

## Technical details
- Photo: `imagegen--edit_image` on `src/assets/interiors/marble-staircase.jpg` with a strict retouch-only prompt, output `marble-staircase-clean.jpg`, update import in `src/pages/Index.tsx`.
- Copy and caption changes confined to `src/pages/Index.tsx`; editorial components unchanged.
