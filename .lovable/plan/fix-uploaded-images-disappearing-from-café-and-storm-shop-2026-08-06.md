# Fix uploaded images disappearing from Café and Storm Shop

## Confirmed diagnosis

- Image transfer is working: three recent Café image files are present in storage, including the latest upload at 9:30 PM Detroit time.
- Those files are not referenced by any Café item or Storm Shop product, so the UI reports “uploaded” even though only the file was uploaded; the item record was never updated.
- The current image picker only puts the returned URL into temporary dialog state. For existing items/products, it does not persist that URL until a separate save succeeds, allowing a refresh or dialog reset to discard it.

## Implementation

1. Change the shared multi-image picker to distinguish “file uploaded” from “image saved to item,” and support an awaited persistence callback.
2. For existing Café items, immediately save the new `image_urls` and primary `image_url` after upload, then refresh the item query only after the database confirms the update.
3. For existing Storm Shop products, immediately save the updated `image_urls` after upload with the same confirmation behavior.
4. Keep new-item/new-product images in the draft until the item itself is created, because there is no record to attach them to yet; make the success message accurately say the image is ready and will be saved with the item.
5. Make both update mutations verify that a row was actually changed and surface a clear error instead of showing success on a zero-row update.
6. Preserve the image preview during query refreshes and only replace it with confirmed database data, preventing the visible “refresh and disappear” behavior.

## Verification

- Upload an image to an existing Café item and confirm it remains visible after closing/reopening the editor and refreshing the page.
- Confirm the Café item’s `image_url` and `image_urls` contain the new stored URL.
- Repeat for an existing Storm Shop product.
- Create a new Café item and a new Storm Shop product with an image, then confirm each image persists after creation and refresh.
- Force a blocked/failed record update and confirm the UI reports that the file uploaded but could not be attached, without claiming full success.