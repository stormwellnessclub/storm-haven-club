## Enhance SMS Send Log with Media Previews

The Activity Log table in the SMS Marketing tab already shows a `media_count` badge, but the count is not clickable and there are no actual image previews. This adds inline thumbnails and a full preview drawer.

### Changes (single file: `src/components/admin/marketing/SmsBlastTab.tsx`)

1. **Inline thumbnails in the Media column**
   - When `media_count > 0`, render up to 3 small (24×24 rounded) thumbnails from `media_urls` next to the count badge.
   - If more than 3 attachments, show `+N` chip after the thumbnails.
   - Fallback to current count-only badge if `media_urls` is empty/null but `media_count > 0` (older rows).

2. **Click-to-expand row drawer**
   - Make each log row clickable; opens a side `Sheet` showing:
     - Timestamp, phone, status, Twilio SID, error message (if any)
     - Full message body (no truncation)
     - Full-size image grid (each click opens in new tab for full resolution)
     - Copy-to-clipboard button for the SID

3. **Body column tweak**
   - Add a small paperclip icon next to truncated body when media is attached, so the column scanning is faster.

### Out of scope
- No DB changes — `media_urls` and `media_count` already exist on `sms_messages`.
- No edge function changes.
- No changes to `SendSmsDialog` or `SmsMediaPicker`.

### Technical notes
- `media_urls` is a `jsonb` array of public Storage URLs from the `sms-media` bucket; render with `<img loading="lazy">` directly.
- Reuse existing shadcn `Sheet`, `Badge`, `Button` components — no new deps.
- Keep the table dense (admin UX principle); thumbnails are 24px so row height stays compact.