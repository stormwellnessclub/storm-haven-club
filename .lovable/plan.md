# Aella Sculpt screening questions: what the safety note means

## Plain explanation
- Before an Aella Sculpt visit, clients fill out health screening questions (for example, "Are you pregnant?" or "Do you have a pacemaker?").
- The safety check noticed that anyone signed in to the site can see the **list of questions**, which is the same blank form every client gets.
- Nobody can see **anyone's answers**. Answers stay private to that client and your staff.
- So no private information is exposed. It's like being able to see a blank paper intake form.

## Options
1. **Leave it as is (recommended).** Clients need to see the questions to fill them out, and nothing private is shown. I would mark the note as reviewed so it stops appearing.
2. **Tighten it.** Only staff and clients with an Aella Sculpt booking can see the question list. This adds a small risk: a client starting a booking might not see the form until the booking is saved.

## Technical details
- Option 1: mark the scanner finding on `spa_screening_questions` as not applicable (public form content, no personal data).
- Option 2: change the read rule on `spa_screening_questions` so it allows staff roles, or users who have a spa appointment for an Aella Sculpt service. Then test the first-visit form as a real client.
