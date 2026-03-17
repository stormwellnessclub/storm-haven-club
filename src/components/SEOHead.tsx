import { Helmet } from "react-helmet-async";

const SITE_NAME = "Storm Wellness Club";
const BASE_URL = "https://www.stormwellnessclub.com";
const DEFAULT_IMAGE = `${BASE_URL}/pwa-512x512.png`;

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;
}

export const SEOHead = ({ title, description, path, ogType = "website" }: SEOHeadProps) => {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const canonicalUrl = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};
