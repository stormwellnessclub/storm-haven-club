import { Helmet } from "react-helmet-async";

const SITE_ORIGIN = "https://stormwellnessclub.com";

export interface SEOProps {
  /** Unique <title> for this page (under 60 chars including brand). */
  title: string;
  /** Unique <meta description> (under 160 chars). */
  description: string;
  /** Origin-root-relative path for this route, e.g. "/spa/massage". */
  path: string;
  /** og:type. Defaults to "website". */
  ogType?: string;
  /** Block indexing. */
  noindex?: boolean;
  /** Page-specific JSON-LD blocks. Each becomes its own <script>. */
  jsonLd?: Array<Record<string, unknown>>;
  /** Override canonical (e.g. /shop -> canonical /merch). */
  canonicalPath?: string;
  /** Per-page og:image override (absolute URL). Sitewide fallback otherwise. */
  ogImage?: string;
}

/**
 * Per-route head tags. Mounts via react-helmet-async into <head>.
 * Sitewide tags live in index.html; this component owns per-page tags
 * (title, description, canonical, og:*, twitter:*, JSON-LD).
 */
export function SEO({
  title,
  description,
  path,
  ogType = "website",
  noindex = false,
  jsonLd,
  canonicalPath,
  ogImage,
}: SEOProps) {
  const canonical = `${SITE_ORIGIN}${canonicalPath ?? path}`;
  const ogUrl = `${SITE_ORIGIN}${path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:type" content={ogType} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}

      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}

      {jsonLd?.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}

export default SEO;
