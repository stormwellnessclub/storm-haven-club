## Goal

Integrate Dr. Storm Durant's long-form Storm Method copy into `/personal-training` without making the page feel heavy. Replace the cliché pull-quote at the same time.

## Edits to `src/pages/personal-training/Overview.tsx`

### 1. Replace the cliché pull-quote
Current:
> "Every session is programmed for the person in front of the coach — your goal, your level, your today."

New (short, science-led, sets up the section below):
> "Built on exercise science, recovery, nutrition, and behavioral psychology — not on a generic template."

Section eyebrow stays: "What you can expect".

### 2. Keep the three tiles below, unchanged
- The Storm Method
- Programmed for your physiology
- Progressed with intent

### 3. Add a new section: "The Storm Method" — placed directly AFTER the three-tile philosophy block, BEFORE the request form

Editorial, two-column layout on desktop, single-column on mobile. Restrained, generous whitespace, no icons, no cards — to keep it from dragging.

**Left column (sticky on desktop)** — small eyebrow + serif headline + attribution:
- Eyebrow: `THE METHOD`
- Headline (serif, large): *The Storm Method*
- Attribution line (muted, small): "Developed by founder Dr. Storm Durant from research on exercise adherence."

**Right column** — the long copy, broken into three short paragraphs and one tight pillar list. Each paragraph is short (2–3 lines) so the eye keeps moving.

Paragraph 1 (lede):
> The Storm Method is a psychology-driven training system that combines fitness, recovery, nutrition, and behavioral science to build a plan around the individual — not a generic program.

Paragraph 2:
> The method begins with understanding how your body responds to training, recovery, stress, and nutrition. That data becomes your biological blueprint, and every part of the program is personalized from it — to improve results and increase long-term consistency.

Pillar list (compact, two columns on desktop, single line items — NOT cards):
- Movement & Exercise Programming
- Recovery Optimization
- Nutrition & Lifestyle Factors
- Accountability & Behavioral Coaching
- Performance & Wellness Metrics

Closing line (italic serif, slightly larger, sets the takeaway):
> "The goal isn't to help someone exercise more — it's to build a system they can actually sustain, so results become a lifestyle, not a short-term outcome."

### 4. Visual treatment to prevent drag
- Section background: `bg-background` (clean) with thin top border to separate from the philosophy block above.
- Vertical padding: `py-24`, max-width `max-w-5xl`.
- Two-column grid `lg:grid-cols-12`: left = `lg:col-span-4` (sticky), right = `lg:col-span-7 lg:col-start-6`.
- No icons, no badges, no cards — only type, rule lines, and one accent color on the eyebrow + final italic line.
- Pillar list uses a hairline left border on each item or a small accent dot — not bullet chips.

## Out of scope
- `PersonalTrainingPage.tsx` (sub-format detail pages).
- Pricing, request form, FAQs.
- Homepage and other site sections.

## Files touched
- `src/pages/personal-training/Overview.tsx` — pull-quote replacement + new Storm Method section.
