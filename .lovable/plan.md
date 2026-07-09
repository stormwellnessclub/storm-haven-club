## Fix cramped approval-letter preview

The "AI Personalized Approval Letter" modal (`src/components/admin/PersonalizedLetterModal.tsx`) currently caps the dialog at `max-w-6xl` and the textarea at `min-h-[400px]` with default width behavior. On many screens the letter body ends up scrolling horizontally inside a narrow box.

### Changes (single file: `src/components/admin/PersonalizedLetterModal.tsx`)

1. `DialogContent` classes → `w-[95vw] max-w-[1200px] max-h-[95vh] overflow-y-auto` so it fills nearly the full screen width.
2. Letter body `Textarea`:
   - `min-h-[600px]` (taller)
   - `w-full` + `whitespace-pre-wrap break-words` so long lines wrap instead of forcing a horizontal scrollbar
   - Slightly larger, more readable typography (`text-base leading-relaxed font-serif`-ish stays, add `resize-y`)
3. Wrap Subject + Body in a single-column layout that stretches to the full dialog width (no inner max-width constraints).

No backend or logic changes — presentation only.
