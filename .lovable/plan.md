# Audit and fix Café and Storm Shop image persistence

## Confirmed audit findings

- Recent Café uploads exist in storage but are not referenced by any Café item or Storm Shop product. The newest orphan is `456d903d-b368-4085-8b27-e0bb7ade5741.jpg` from August 6 at 6:00 PM Detroit time.
- All five Storm Shop products currently have empty `image_urls`; the `merch-images` bucket has no stored objects.
- The checked-in client code sends an attachment target for an existing Café item or Storm Shop product and is supposed to reject success unless the backend returns `attached: true`.
- The checked-in backend code is supposed to update the item before returning success and delete the uploaded file if attachment fails.
- Those guarantees contradict the live result: orphan files remain while the UI reports success. There are also no recent `upload-image` function logs. This indicates the live browser request is not completing the checked-in upload-and-attach path; the exact deployed/request path must be captured before changing logic again.
- Café has a second display inconsistency: several records contain a newer URL in `image_urls` while `image_url` still points to an older asset. The admin list and public Café currently render `image_url`, so a successfully stored array image can remain invisible.
- Storm Shop renders `image_urls[0]`, but there are currently no saved product image references to render.

## Audit-first implementation

1. Add a versioned, traceable response to the upload function with a request ID, target type/ID, stored path, attachment result, and confirmed persisted URL. Log the same non-sensitive fields server-side.
2. Capture the real authenticated Café and Storm Shop upload requests and verify:
   - which function/version receives them,
   - whether `targetType` and `targetId` are present,
   - which record ID is updated,
   - and what row is read back before success is returned.
3. Make the backend response transactional in behavior:
   - upload the file,
   - attach it to the requested record,
   - read the record back,
   - verify the exact URL is present,
   - remove the file and return an error if any attachment/verification step fails.
4. Make the client accept success only when the response version matches and contains the requested target ID plus the read-back-confirmed URL. A storage-only result must never produce an “uploaded and saved” message.
5. Remove the duplicate persistence paths for existing records. The backend will be authoritative for upload-and-attach; reorder/removal and normal form edits will use the existing verified update mutation.
6. Normalize Café image selection so the first `image_urls` value is the primary image, with `image_url` synchronized for compatibility. Render through one shared primary-image rule in the admin list and public Café.
7. Keep new-item uploads explicitly draft-only until creation succeeds, then verify the created row contains the image URL before reporting success.
8. Clean up only the confirmed orphan files produced by failed attempts after matching them against all image reference columns; do not remove legacy assets that are still referenced.

## Verification

- Existing Café item: upload one image, confirm the response identifies that item, query the row, close/reopen the editor, refresh, and confirm the same image appears in admin and public Café.
- Existing Storm Shop product: repeat the same checks in admin and public Storm Shop.
- New Café item and new Shop product: upload during creation, save, refresh, and confirm persistence.
- Failure test: use an invalid/missing target and confirm no success message appears and no orphan file remains.
- Confirm the request ID appears in function logs and the returned URL loads successfully.
- Confirm all saved Café records use a consistent primary URL after normalization.

Authenticated path: **UNVERIFIED** until the signed-in preview session is available to the browser test runner; prior user attempts confirm the symptom but do not expose the request trace needed for runtime verification.