import { Helmet } from "react-helmet-async";

interface JsonLdProps {
  /** One or many JSON-LD schema objects. Each renders as its own <script> tag. */
  data: unknown | unknown[];
}

/**
 * Render one or more JSON-LD schema blocks via Helmet.
 *
 * Usage:
 *   <JsonLd data={buildBreadcrumbLd([...])} />
 *   <JsonLd data={[buildServiceLd({...}), buildFAQLd(faqs)]} />
 */
export const JsonLd = ({ data }: JsonLdProps) => {
  const items = Array.isArray(data) ? data : [data];
  return (
    <Helmet>
      {items.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};
