## Plan

1. **Clean up the Cafe page UI**
   - Remove the visible Cafe FAQ block from `/cafe`.
   - Remove the visible “After the café, recover” cross-link section because it reads like SEO content rather than cafe UI.
   - Keep the actual cafe ordering/menu experience unchanged.

2. **Keep SEO hidden where it belongs**
   - Keep `<SEOHead>` metadata and JSON-LD schema in the document head so search engines still get page metadata.
   - Do not render FAQ/schema copy as visible content inside the cafe menu/page.

3. **Audit obvious SEO-like UI sections**
   - Check public pages for visible “SEO” scaffolding such as FAQ blocks added only for ranking, forced local-service link sections, or wording that looks written for crawlers.
   - Prioritize removing/hiding crawler-only content from the actual user interface while preserving legitimate user-facing pages like the standalone `/faq` page.

4. **Verify the result**
   - Confirm `/cafe` no longer shows the cafe FAQ or SEO-style recovery link section.
   - Confirm the cafe menu still loads cafe items only.