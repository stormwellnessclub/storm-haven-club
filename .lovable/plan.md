

## Reorder Homepage Sections

The only change needed is moving the **Aella Spa** section (currently 4th content section) to after the **Philosophy** section (currently 6th). Everything else is already in the correct relative order.

### Current order → New order

| # | Current | New |
|---|---------|-----|
| 1 | Hero | Hero *(no change)* |
| 2 | Quick Nav | Quick Nav *(no change)* |
| 3 | Studios + Community | Studios + Community *(no change)* |
| 4 | **Aella Spa** | **Member Benefits / Recovery** |
| 5 | Member Benefits / Recovery | **Philosophy** |
| 6 | Philosophy | **Aella Spa** |
| 7 | Café | Café *(no change)* |
| 8 | Kids Care | Kids Care *(no change)* |
| 9 | Final CTA | Final CTA *(no change)* |

### File changed
- `src/pages/Index.tsx` — move the Aella Spa section (lines 217-267) to after the Philosophy section (after line 353). No copy, image, or style changes.

