# Front Desk Concierge Bell: Softer Sound, Working Resolve, Received Button

Three fixes, all on the front desk side of the support/concierge inbox.

## 1. Gentler, quieter chime

The current chime is a six-note double triad built with added harmonics, a soft-clip drive stage, a compressor, and a 4.5x gain boost — that combination is what makes it harsh and loud.

Replace it with a calm two-note bell:
- Two soft sine tones (no added harmonics, no soft-clip distortion), gentle attack and a natural decay to silence.
- Drop the WebAudio boost from 4.5x to roughly 1.0x and remove the compressor stage, so it plays at a normal notification level.
- Keep everything else identical: same mute toggle, same "Test chime" button, same reminder cadence.

## 2. "Resolved" actually clears the item

Confirmed cause: the `front_desk` role has only SELECT permission on support conversations — the manage policy covers `admin`, `manager`, and `super_admin` only. When a front desk user clicks Resolve, the update matches zero rows, returns no error, so the app shows "Request resolved" while the item stays on screen.

Fix: add a `kiosk_resolve_conversation` RPC (same guarded pattern as the existing `kiosk_acknowledge_conversation`, requiring a signed-in staff user) and have the front desk panels call it instead of updating the table directly. The action will also verify a row was actually changed, so a blocked resolve shows an error instead of a false success.

## 3. Received button on the front desk kiosk panel

The front desk reception panel is an older copy of the support panel that never got the acknowledgement UI. Bring it to parity with the admin check-in panel:
- A **Received** button on each request that silences the recurring reminder bell for that request on every device.
- A **Received** badge showing who marked it and when, with an **Undo** to re-arm the bell.
- Received items stay in the list, dimmed, still with their Resolve button.

## Technical notes

- `src/components/admin/AdminSupportChime.tsx`: rewrite `generateChimeWav` tone table (2 sine tones, no harmonic/tanh stage), set `CHIME_GAIN` to 1.0, drop the `DynamicsCompressor` node.
- New migration: `public.kiosk_resolve_conversation(p_conversation_id uuid)` — SECURITY DEFINER, `PERFORM public.assert_kiosk_staff();`, sets `status = 'resolved'`, `REVOKE ... FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated, service_role`.
- `src/pages/FrontDesk.tsx` (`KioskSupportPanel`): select `acknowledged_at` / `acknowledged_by_name`, add `handleAcknowledge` via `kiosk_acknowledge_conversation`, switch `handleMarkDone` to the new RPC, and add the Received/Undo control plus badge to `KioskConversationItem`.
- `src/components/admin/CheckInSupportPanel.tsx`: switch `handleMarkDone` to the same RPC so front desk staff on the admin check-in page get a real resolve too.
