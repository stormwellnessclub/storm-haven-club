# Publish the Storm Café Rebuild to Live

## What's going on

- **Preview** (what I tested): new v1 calm editorial café design is live — confirmed via screenshot
- **Live site** (`stormwellnessclub.com`, `storm-haven-club.lovable.app`): still serving the OLD café UI because frontend changes don't auto-deploy

Your member portal "looks unchanged" because you're viewing the published site, not the preview. The fix is to publish.

## Plan

1. I publish the project for you (the rebuild + the previous café/index.css/tailwind changes all ship together)
2. I do the publish preflight: site info on `/cafe` is already correct (SEO title, meta description, restaurant + breadcrumb + FAQ JSON-LD, OG via SEOHead). No metadata changes needed — pass `already_relevant`
3. Deployment kicks off; live in ~1 minute
4. After it lands, hard-refresh `/member/cafe` once on your phone/desktop to clear the old service worker bundle, then the new design will appear everywhere

## What does NOT change

- Code (no edits needed — preview is already correct)
- Visibility, custom domain, badge settings
- Backend / DB / Stripe

## Confirm

Want me to publish now?
