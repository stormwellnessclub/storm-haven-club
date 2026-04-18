

## Plan: Replace zone grid with clickable body diagram (front + back)

### What changes
Replace the current 16-button focus-area grid in `SpaIntakeForm.tsx` with an interactive **SVG body diagram** showing front and back views side-by-side. Members tap zones directly on the figure; selected zones highlight in gold.

### Implementation

**New component**: `src/components/spa/BodyDiagram.tsx`
- Inline SVG with two anatomical silhouettes (front + back), gender-neutral
- Each body zone is a `<path>` or `<polygon>` with `data-zone="neck"`, etc.
- Clicking a zone toggles selection; selected zones fill with `hsl(var(--accent))` at 70% opacity
- Hover state: lighter accent tint + cursor pointer
- Labels below each view: "Front" / "Back"
- Responsive: scales to container width, max ~400px tall on mobile, side-by-side on sm+

**Zones mapped (16 total, matching existing `FOCUS_AREAS`)**
- Front: head/scalp, face, neck (front), chest, shoulders, arms, abdomen, hips, quads, shins, feet
- Back: neck (back), upper back, mid back, lower back, glutes, hamstrings, calves

**Integration in `SpaIntakeForm.tsx`**
- Replace the `grid grid-cols-2 sm:grid-cols-3 gap-2` button block with `<BodyDiagram selected={focusAreas} onChange={setFocusAreas} />`
- Keep the "select all that apply" label and the validation hint
- Show selected zones as small chips below the diagram for clarity ("Neck ×", "Lower Back ×") — tap chip to deselect
- Keep everything else (pressure, pain, health, consent) unchanged

**Staff view (`IntakeFormSummary.tsx`)**
- Add a small read-only mini-diagram showing the highlighted zones at the top of the focus areas row
- Keep the text badges below for quick scanning

### Files
- **New**: `src/components/spa/BodyDiagram.tsx` (interactive) + `BodyDiagramReadOnly.tsx` (smaller, non-interactive variant for summary)
- **Modified**: `src/components/spa/SpaIntakeForm.tsx`, `src/components/spa/IntakeFormSummary.tsx`

### Notes
- Pure inline SVG — no external image assets, no extra dependencies, works offline, scales crisply
- Same `focus_areas` string array stored in DB (no migration needed)
- "Side view" is uncommon for massage intake; **front + back** is the clinical standard and covers every zone. If you specifically want a true side profile too, say so and I'll add a third silhouette

