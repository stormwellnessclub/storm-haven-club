# Make book club sign-ups easy to find

## What I found
- 3 members have already filled out the Higher Self Society form. Their answers are saved.
- The list is at Events Portal → Higher Self Society. The direct address is /events-portal/society.
- The admin menu link and the phone-friendly tabs I added last time are still only in your preview. They are not on the live site yet, so you won't see them on stormwellnessclub.com.

## Plan
1. **Put it where you already look.** Add a "Book club sign-ups" box to the main admin dashboard. It shows the number of sign-ups and the newest names, and it opens the full list when you tap it.
2. **Make the link stand out.** Give the admin menu its own "Higher Self Society sign-ups" item at the top level, with a count of new sign-ups. It won't be tucked inside the Events Portal group.
3. **Put the list first.** On the Higher Self Society screen, show the list of people who signed up at the top. Move the email tools below it, because they currently push the list off the screen on a phone.
4. **Check it.** Sign in as an admin, open the list on a phone-sized screen and confirm all 3 sign-ups show.
5. **You publish.** Click Publish → Update so all of this goes live.

## Technical details
- New dashboard widget queries `higher_self_society_interest` (count + latest 5), visible to super_admin/admin/manager only (matches existing RLS).
- AdminSidebar: promote the item to a top-level entry with a count badge.
- EventsPortalSociety.tsx: move `SocietyInviteEmailControls` below the roster, or into a collapsible section.
