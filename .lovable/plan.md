
## Fix what you’re seeing

Preview does **not** have an “Update” button. It should auto-refresh after code changes are applied. If it doesn’t, I’ll flush the preview refresh after the edit so you can see it immediately.

## Menu tab change

Update the cafe menu grouping so:
- Remove the standalone **Cold Pressed Juice** tab.
- Add **Cold Pressed Juice** into the existing **Energy & Hydration** tab.
- Keep **Functional Smoothie** and **Protein Smoothie** under **Smoothies**.

## Description behavior already intended

Keep the description behavior as:
- Short teaser on each menu card.
- Tap card / “View details” to open the full description/details panel.
- Add to Order and Customize remain separate actions.

## Technical scope

- Edit only `src/components/cafe/CafeOrderContent.tsx`.
- Flush the preview refresh after the edit so the change appears in Preview without publishing.
- No database changes.
