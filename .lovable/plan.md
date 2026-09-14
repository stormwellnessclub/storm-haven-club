# Storm home page editorial redesign

## Goal
Rebuild the public home page in the supplied editorial wellness direction while preserving Storm’s brand, routes, authentication, announcements, SEO, accessibility, and conversion paths.

## What will change
- Replace the current long, card-heavy home page with a composed editorial layout using generous spacing, oversized serif typography, warm neutral surfaces, and restrained terracotta accents.
- Use the new meditation hero artwork for the opening section, with Storm-specific copy and clear membership and schedule actions.
- Add a short editorial introduction, a three-image philosophy composition, and three numbered value pillars.
- Add a dark full-width amenities band highlighting movement, recovery, and restoration with concise links.
- Add a closing membership invitation using existing Storm photography and direct application/sign-in actions.
- Refine the home-page navigation presentation so it reads cleanly over the hero while retaining all current desktop, mobile, and account behavior.
- Keep the existing shared footer and operational components; remove home-page-only sections that duplicate the new story.

## Technical details
- Rework `src/pages/Index.tsx` with semantic sections, responsive image crops, accessible heading order, lazy loading below the fold, and existing React Router links.
- Add scoped home-page styles to `src/index.css` for the editorial type scale, split layouts, dark band, subtle reveal motion, and reduced-motion support.
- Make narrowly scoped styling adjustments in `src/components/Navigation.tsx` only where needed for the new hero treatment.
- Use existing Storm photography plus the generated `src/assets/home-hero-wellness.jpg`; no backend, membership logic, or admin behavior changes.
- Validate the production build and inspect desktop and mobile renders for overflow, readability, navigation behavior, and image cropping.
