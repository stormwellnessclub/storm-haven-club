

## Plan: Add Kids Care Launch Email Template

### What you'll get
A pre-built email template added to the Marketing Portal's Templates tab, ready to send to members announcing Kids Care is now open with limited hours and available packages.

### Email copy

**Template Name:** Kids Care Launch Announcement  
**Category:** Announcement  
**Subject:** {name}, Kids Care Is Now Open at Storm Haven!  
**Merge Fields:** name, clubName

**Body (HTML):** A branded announcement email covering:
- Headline: Kids Care is officially open
- Brief intro: supervised childcare while parents enjoy the club
- Two rooms: Little Stars (infants/toddlers) and Big Stars (preschool/school age)
- Packages: Member Pass ($75/month for 4 sessions) and Single Session ($40)
- Limited hours notice with link to check the schedule
- CTA button to book/register
- Note about registering child profiles first

### Steps

1. **Create a database seed** — Insert the template directly into the `email_templates` table via a migration so it's available as a system template (or add it through the existing create-template UI logic)

2. **Alternative (simpler):** Pre-populate the template by adding a "seed templates" function that inserts the Kids Care announcement template on first load, or simply add it via the existing TemplatesTab create form programmatically

Since templates are managed through the UI's create form and stored in `email_templates`, the cleanest approach is to **insert the template via a database migration** so it appears as a system template that can't be accidentally deleted.

### Implementation
- One SQL migration to insert the template row into `email_templates` with `is_system = true`
- No code changes needed — the existing Templates tab will display it automatically

