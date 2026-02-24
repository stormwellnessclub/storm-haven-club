

## Events Page for Storm Wellness Club

### Overview
Create a branded public Events page at `/events` with two sections:
1. **Upcoming Events** - A curated showcase of club events with rich cards
2. **Host an Event** - An inquiry form for people interested in hosting events at the club

Both sections will be backed by database tables so admins can manage events and review hosting inquiries.

---

### Database

**Table: `events`**
- `id` (uuid, PK)
- `title` (text)
- `description` (text)
- `event_date` (date)
- `start_time` (time)
- `end_time` (time)
- `location` (text) - e.g. "Main Studio", "Rooftop Lounge"
- `image_url` (text, nullable)
- `category` (text) - e.g. "Wellness", "Social", "Workshop", "Community"
- `is_members_only` (boolean, default false)
- `capacity` (integer, nullable)
- `is_published` (boolean, default true)
- `created_at` / `updated_at` (timestamps)

RLS: Public read for published events. Admin insert/update/delete.

**Table: `event_hosting_inquiries`**
- `id` (uuid, PK)
- `full_name` (text)
- `email` (text)
- `phone` (text, nullable)
- `event_type` (text) - what kind of event they want to host
- `preferred_date` (text, nullable)
- `estimated_guests` (integer, nullable)
- `message` (text)
- `status` (text, default 'pending') - pending / contacted / approved / declined
- `created_at` (timestamp)

RLS: Public insert (anyone can submit). Admin read/update.

---

### Frontend

**New file: `src/pages/Events.tsx`**

Fully branded page using the existing `Layout`, `SectionHeading`, `AnimatedSection`, and `StaggerContainer` components. Structure:

1. **Hero Section** - Dark overlay on a club image (reuse `main-lobby.jpeg`), with the heading "Upcoming Events" and a tagline. Matches the style of the homepage hero but shorter.

2. **Events Grid** - Cards showing each published event with:
   - Event image (or a gradient placeholder if no image)
   - Category badge
   - Date formatted nicely (e.g. "SAT, MAR 15")
   - Title, description preview
   - Time and location
   - "Members Only" badge where applicable
   - Staggered scroll-reveal animations

3. **Empty State** - If no events exist, a styled message saying "Stay tuned for upcoming events."

4. **Host an Event Section** - Dark `bg-primary` section (matching the membership benefits section style) with:
   - Heading: "Host Your Event at Storm"
   - Brief copy about the venue
   - Form fields: Name, Email, Phone, Event Type (dropdown), Preferred Date, Estimated Guests, Message
   - Submit button with `variant="gold"`
   - Success toast on submission

**Route**: Add `/events` to `App.tsx` as a public route.

**Navigation**: Add "Events" link to `navLinks` in `Navigation.tsx` and "Events" to the footer links.

---

### Technical Details

| Item | Detail |
|------|--------|
| New files | `src/pages/Events.tsx` |
| Modified files | `src/App.tsx` (route), `src/components/Navigation.tsx` (nav link), `src/components/Footer.tsx` (footer link) |
| Database | 2 new tables: `events`, `event_hosting_inquiries` with RLS policies |
| Dependencies | None new -- uses existing react-hook-form, zod, sonner, date-fns |
| Styling | Matches existing brand: Cormorant Garamond headings, Montserrat body, gold accents, card-luxury class, charcoal dark sections |

