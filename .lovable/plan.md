# Restore Images and Repair Uploads

## Goal
Restore every unintentionally changed Café image, including the Signature/Functional Smoothies, and make Café and Storm Shop uploads persist reliably without altering existing images.

## Confirmed findings
- The newest Café files exist in storage but are not referenced by any Café item.
- The corresponding live upload requests had no target type or target item ID, so they could upload a file but could not attach it to a record.
- The current image system mixes legacy `image_url` with the newer `image_urls` gallery. The prior normalization changed which field controls the displayed cover image and therefore changed existing item photos.
- Existing-item and new-item forms use different persistence paths; both must be tested independently.

## Implementation
1. **Restore first**
   - Build an exact before/current inventory from repository history, storage filenames, and current Café records.
   - Restore the prior cover image for every affected item, explicitly including all Signature/Functional Smoothies.
   - Preserve legitimate gallery images and do not delete storage files.
   - Present the affected-item list and restoration result separately from the upload fix.

2. **Remove the conflicting image authority**
   - Stop globally treating the first gallery entry as a replacement for an existing legacy cover.
   - Define one explicit cover-image rule that preserves current approved covers and only changes a cover when the user intentionally chooses or removes it.
   - Keep Café and Storm Shop behavior consistent without bulk-normalizing existing data.

3. **Fix existing-item uploads**
   - Ensure the selected record ID and type are present before an upload can start.
   - Attach the uploaded URL to that exact record, read it back, and update the open form/query cache from the confirmed database result.
   - Show success only after the returned record contains the URL; otherwise show an error and leave the existing images unchanged.

4. **Fix new-item uploads**
   - Avoid uploading orphan files before a record exists.
   - Save the new item first, then upload and attach images using its returned ID, or keep files pending until creation completes.
   - Keep the dialog open if image attachment fails so the item and files can be retried safely.

5. **Prevent stale-client false success**
   - Make the client verify the current upload response contract and attached record rather than trusting a generic upload response.
   - Refresh only the relevant Café or Shop query; do not reload the page or discard dialog state.

## Verification
- Compare every restored affected item against its recovered prior cover.
- Upload a new image to one existing Café item and confirm the exact URL remains attached after closing, reopening, and a full browser refresh.
- Repeat for one existing Storm Shop product.
- Create a new Café item and a new Shop product with an image, then confirm both persist after refresh.
- Confirm an upload cannot report success when its target ID is missing or its URL is absent from the saved record.
- Confirm unrelated item images and gallery order remain unchanged.

## Technical boundaries
- No bulk rewrite of `image_url` or `image_urls`.
- No deletion of existing images.
- No unrelated Café or Shop changes.