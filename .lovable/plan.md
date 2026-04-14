
Issue summary:
- The active liability waiver record in the database is correct: it points to `liability-waiver.pdf`.
- The local asset exists in `src/assets/agreements/liability-waiver.pdf`.
- `resolvePdfUrl()` already maps that filename correctly.
- The current PWA config already includes PDF caching, so the original fix is present.
- That means the remaining problem is likely stale/interfering service-worker behavior plus weak download handling that treats a 404 response like a successful fetch.

Plan:
1. Harden PWA behavior in preview/development
- Update the PWA config so the service worker is disabled in development.
- Add a preview/iframe guard in the app entry so service workers are unregistered on Lovable preview hosts and inside iframes.
- Keep PDF runtime caching only for production/published use.

2. Harden PDF download/open behavior
- Update `SimpleAgreementCard` and `AgreementPDFViewer` download helpers to check `response.ok` before creating a blob.
- If a fetch returns 404/HTML instead of a real PDF, fall back cleanly and avoid pretending the download succeeded.
- Prefer resolved asset URLs consistently so waiver links never rely on raw unresolved strings.

3. Preserve current waiver UI
- Do not redesign the waiver flow.
- Keep the existing buttons, signing flow, and agreement components intact.
- Only change the delivery/resolution behavior behind them.

Files to update:
- `vite.config.ts`
- `src/main.tsx`
- `src/components/SimpleAgreementCard.tsx`
- `src/components/AgreementPDFViewer.tsx`

Technical details:
- Add `devOptions: { enabled: false }` to the PWA plugin.
- Add a runtime check like:
  - preview host (`id-preview--...`, lovable preview domains)
  - iframe context (`window.self !== window.top`)
  Then unregister any existing service workers there.
- In fetch-based download helpers, throw when `!response.ok` before calling `response.blob()`.

Expected result:
- Waiver PDFs should stop 404ing in preview due to stale service workers.
- Download buttons should no longer silently “download” a broken 404 response.
- Published production behavior remains intact for real users.
