import { Helmet } from "react-helmet-async";

const SITE_NAME = "Storm Wellness Club";
const BASE_URL = "https://stormwellnessclub.com";
const DEFAULT_IMAGE = `${BASE_URL}/og/og-default.jpg`;

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;
  /** Absolute or root-relative image URL. Defaults to PWA logo. */
  image?: string;
  imageAlt?: string;
  /** Set true to add a noindex robots meta (e.g. utility pages). */
  noindex?: boolean;
  /** Optional JSON-LD schema object(s) to inject into the head. */
  jsonLd?: unknown | unknown[];
}

export const SEOHead = ({
  title,
  description,
  path,
  ogType = "website",
  image,
  imageAlt,
  noindex,
  jsonLd,
}: SEOHeadProps) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = `${BASE_URL}${path}`;
  const resolvedImage = image
    ? image.startsWith("http")
      ? image
      : `${BASE_URL}${image.startsWith("/") ? image : `/${image}`}`
    : DEFAULT_IMAGE;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedImage} />
      {imageAlt && <meta name="twitter:image:alt" content={imageAlt} />}

      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
};
