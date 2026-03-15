

## Problem

The `sitemap.xml` file exists in `public/` and works in local development, but on production (`stormwellnessclub.com`) it returns a 404 page. This is because the hosting layer routes all requests through `index.html` (SPA catch-all), and React Router doesn't know about `sitemap.xml`, so it renders the 404 component.

The same issue applies to `robots.txt` — it may or may not be affected depending on the hosting config.

## Root Cause

Lovable's hosting serves all paths through the SPA. Static files in `public/` like `sitemap.xml` and `robots.txt` need to be served before the SPA catch-all takes over. This is a hosting-level behavior, not a code issue.

## Solution

Since we can't change the hosting server config, we work around it by serving sitemap and robots content through the app itself:

### 1. Create an edge function to serve sitemap.xml
- Create `supabase/functions/sitemap/index.ts`
- Returns the XML content with `Content-Type: application/xml`
- Contains all 15 URLs currently in `public/sitemap.xml`

### 2. Create an edge function to serve robots.txt
- Create `supabase/functions/robots/index.ts`  
- Returns the robots.txt content with `Content-Type: text/plain`

### 3. Add client-side route interception
- In the React Router config, add routes for `/sitemap.xml` and `/robots.txt` that redirect to the edge function URLs
- Alternatively, add a small component that fetches from the edge function and renders raw XML/text

### Alternative approach (simpler)
Rather than edge functions, we can handle this purely client-side:
- Add a `/sitemap.xml` route in React Router that renders the XML directly with the correct content type via a meta refresh or by setting `document.location` to the edge function
- Actually, the simplest fix: **Add a route in React Router for `/sitemap.xml`** that uses `useEffect` to replace the document content with raw XML

**Recommended approach**: Create a single backend function that serves both files, and add React Router routes that redirect to them. This guarantees correct content types and works with all crawlers.

### Files

**Create:**
- `supabase/functions/serve-static/index.ts` — serves sitemap.xml and robots.txt with correct content types based on query param

**Modify:**
- `src/App.tsx` (or wherever routes are defined) — add routes for `/sitemap.xml` and `/robots.txt` that redirect to the edge function

