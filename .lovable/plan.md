# Add "Change photo" to the Higher Self Society last-call email

## What you'll see
- A photo preview in the **Last call** box (Events Portal → Higher Self Society), showing the bookshelf photo by default.
- A **Change photo** button for uploading a JPG or PNG (up to 5 MB) from your phone or computer. The preview updates as soon as the upload finishes.
- A **Use original photo** link to switch back to the bookshelf photo.
- Test emails and the real send both use whichever photo is showing. Texts stay text-only.

## Technical details
- Create a public storage bucket `email-images`. Only admin and manager staff can upload to it (enforced by storage RLS through `has_any_role`); anyone can read, since email clients need to load the image.
- `SocietyLastCallControls.tsx`: add a file input. Upload goes to `email-images/society-last-call/<timestamp>.<ext>`, then the public URL is kept in component state and passed as `heroUrl` to every preview, test and send call.
- `send-society-last-call`: accept an optional `heroUrl`. Accept it only if it starts with this project's storage public URL for `email-images`; otherwise fall back to the default photo. The value is HTML-escaped and replaces the default image.
- Redeploy `send-society-last-call`. Nothing gets sent while building this.
