

## Problem

The `/site-audit` page is a React component -- it only renders in a browser that executes JavaScript. When Claude AI fetches the URL, it gets the empty SPA shell (`index.html`) and sees nothing useful. Claude needs raw HTML served directly from the server.

## Solution

Add a `file=site-audit` option to the existing `serve-static` edge function that returns a full, self-contained HTML page with all the audit content baked in. No JavaScript required -- just static HTML that any tool (Claude, curl, crawlers) can read directly.

Then update the React `SiteAudit.tsx` page to also link to this direct URL so you can share it with Claude.

## Changes

### 1. Update `supabase/functions/serve-static/index.ts`
- Add a `file === "site-audit"` branch that returns a complete HTML document containing the full site audit (all pages, descriptions, features, business info)
- Serve with `Content-Type: text/html; charset=utf-8`

### 2. Update `src/pages/SiteAudit.tsx`
- Add a "Copy Link for AI" button that copies the direct edge function URL (`https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/serve-static?file=site-audit`)
- This is the URL you paste into Claude -- it will fetch the raw HTML directly

### 3. Update `src/components/StaticFileRedirect.tsx` (if needed)
- Add a redirect for `/site-audit.html` to the edge function, similar to sitemap/robots

This way, when you give Claude the direct URL, it fetches a fully rendered HTML page with all your site info -- no JS execution needed.

