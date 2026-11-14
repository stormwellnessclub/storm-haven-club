# Move tomorrow's 10:45 class to 11:10 AM with Klaudia

## The class
- Booty Bootcamp, Saturday Nov 14, Aerobics Studio, 10:45–11:35 AM, currently taught by "Storm S"
- 2 people signed up

## What changes
1. Move this one class (only tomorrow, not the weekly schedule) to 11:10–12:00 PM. It stays 50 minutes.
2. Make Klaudia Selim the instructor and lock it so the weekly schedule doesn't switch it back.
3. Both people stay booked. Their spots, credits and payments don't change.
4. Send each of them one text and one email:
   "Storm Wellness Club: Your Booty Bootcamp class on Sat, Nov 14 now starts at 11:10 AM (was 10:45 AM) with Klaudia. Your spot is saved. Reply or call us if this doesn't work for you."
   - Texts go through the normal text sender, which checks permission. Anyone who opted out gets the email only.
   - Each person gets the message once, even if a send is retried.
5. Check that the schedule shows 11:10 with Klaudia, and confirm who got the text and the email.

## Technical details
- Update the `class_sessions` row `0d7e241b…`: set start_time 11:10, end_time 12:00, instructor_id to Klaudia, and instructor_overridden = true.
- Check room conflicts in the Aerobics Studio 11:10–12:00 (the 12:00 Reformer class is cancelled and in another room).
- Get contacts from the 2 confirmed bookings (account, member, or walk-in fields). Send the text with `send-sms` (no bypassConsent) and the email with the existing class-notice email sender. Save a record of each send.
