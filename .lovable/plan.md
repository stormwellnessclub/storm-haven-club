

# Expand Application Details View & Fix Layout Issues

## Problems Identified

1. **Application detail dialog is too small** (`max-w-2xl`) — forces horizontal scrolling and cramped content
2. **Missing application fields** — the detail view skips several fields that applicants fill out:
   - Date of birth
   - Country
   - Motivations (array)
   - Other goals / Other motivation / Other services (free text)
   - Previous member status
   - Agreement acknowledgments (membership agreement, one-year commitment, credit card auth)
3. **Personalized letter modal** (`max-w-4xl`) is also constrained as a dialog within a dialog

## Plan

### 1. Convert application detail from dialog to full-page view
Instead of opening a small dialog, clicking an application will navigate to a dedicated detail page (`/admin/applications/:id`) or expand into a full-width slide-over panel. This eliminates the cramped box problem entirely.

**Approach**: Replace the `Dialog` with a full-width sheet/panel that slides in from the right, taking ~70% of the screen width. This keeps you on the Applications page (no route change needed) but gives ample room.

- Change from `<Dialog>` to a side panel using the existing `Sheet` component or a full-width layout
- Set width to `max-w-4xl` minimum with full-height scrolling
- Organize content into clear sections with headers

### 2. Add all missing application fields to the detail view
Update the `Application` type to include all database columns, then display them in organized sections:

- **Personal Info**: Name, DOB, gender, email, phone, address (full with country)
- **Membership**: Plan/tier, founding member status, previous member, referred by
- **Wellness Profile**: Goals, motivations, services interested, holistic wellness, lifestyle integration, other goals/services
- **Payment & Status**: Annual fee status, Stripe customer, card on file, payment info
- **Agreements**: Membership agreement signed, one-year commitment acknowledged, credit card authorization
- **Admin**: Notes, status history, charge history, member link status, actions

### 3. Widen the personalized letter modal
Increase the `PersonalizedLetterModal` to near-full-screen (`max-w-5xl` or `max-w-6xl`) so the letter editor has comfortable space.

### Files to modify
- **`src/pages/admin/Applications.tsx`** — Replace detail `Dialog` with full-width side panel, update `Application` type to include all DB fields, add missing field sections to the detail view
- **`src/components/admin/PersonalizedLetterModal.tsx`** — Widen the dialog

