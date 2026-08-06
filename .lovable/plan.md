# Fix Café and Storm Shop image uploads

## Confirmed diagnosis

- Both Café and Storm Shop already call the shared `uploadImageToBucket` helper.
- That helper first calls the protected `upload-image` backend function, but if that request fails it silently retries a direct browser-to-storage upload.
- The visible `new row violates row-level security policy` message comes from that fallback, not from the intended staff-verified upload path.
- The live storage policies allow Café uploads for approved Café/admin roles and merchandise uploads for admin/manager roles. The buckets exist and are public for image delivery.
- The deployed backend function responds and correctly rejects requests without a signed-in session. A signed-in end-to-end upload is not yet verified.

## Implementation

1. Harden the shared upload helper so it refreshes/validates the current staff session before invoking the backend function.
2. Remove the direct storage fallback that masks the real failure with an RLS error.
3. Preserve client-side compression and send the authenticated request to the existing staff-verified upload function for both Café and Storm Shop.
4. Return the backend's specific error to the UI so expired login, missing role, invalid file, and storage failures are distinguishable.
5. Review the backend function's service-client setup and upload response handling; adjust only if needed for the authenticated request.
6. Deploy the updated upload function if its code changes.

## Verification

- Upload a real image from the Café editor while signed in as an allowed staff user; confirm the file is stored and the menu item receives its URL.
- Upload a real image from Storm Shop while signed in as an admin/manager; confirm the product receives its URL.
- Confirm a signed-out request is denied cleanly and never attempts the direct RLS-scoped fallback.
- Confirm unsupported roles cannot upload.

Authenticated path: **UNVERIFIED** until a signed-in browser upload is executed.