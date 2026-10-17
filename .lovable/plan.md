# Ask for a card when booking a client who has none

## What changes
When staff book a spa appointment (including "Book this request"), the booking screen checks whether the client has a card saved.

- **Card on file:** nothing new. It shows "Card on file: Visa ending 1234" and staff book as usual.
- **No card on file:** a red box appears: "No card on file. Ask the client for a card to hold this appointment." It has two buttons:
  - **Add card now**: staff type the card in while the client is on the phone or at the desk. It saves to their account. Nothing is charged.
  - **Text/email card link**: sends the client a link to add their card.
- Staff can still finish the booking. The appointment then shows "Card needed to hold" until a card is saved, so the front desk knows to follow up.

Nothing cancels automatically.

## Technical details
- In AdminSpaBookingModal, look up the selected client's card (members/non_member_profiles card_last4) once a client is picked.
- "Add card now" reuses the existing staff add-card screen (AdminChargeWith3DS/setup flow from the non-member CRM); "send link" reuses the existing card-on-file link.
- Keep the existing "Card needed to reserve" tag on booked requests, and add the same tag to the appointment badge in Appointments/edit modal.
