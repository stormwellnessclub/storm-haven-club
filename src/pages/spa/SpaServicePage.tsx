import { Navigate, useParams } from "react-router-dom";
import ServiceLandingPage from "@/components/seo/ServiceLandingPage";
import { SPA_CATEGORIES, getService } from "@/lib/spa-content";

interface Props {
  category: string;
}

export default function SpaServicePage({ category }: Props) {
  const { slug = "" } = useParams<{ slug: string }>();
  const cat = SPA_CATEGORIES[category];
  const service = getService(category, slug);

  if (!cat || !service) {
    return <Navigate to={`/spa/${category}`} replace />;
  }

  const path = `/spa/${cat.slug}/${service.slug}`;
  const durationsLabel = service.durations.join(" or ");

  // Sibling related links inside same category
  const related =
    service.related?.flatMap((rs) => {
      // Search across all categories for the slug (recovery siblings live elsewhere)
      for (const c of Object.values(SPA_CATEGORIES)) {
        const found = c.services.find((s) => s.slug === rs);
        if (found) return [{ to: `/spa/${c.slug}/${found.slug}`, label: found.name }];
      }
      // Fallback to standalone recovery pages by slug
      const standalone: Record<string, string> = {
        "red-light-therapy": "Red Light Therapy",
        cryotherapy: "Cryotherapy",
        "infrared-sauna": "Infrared Sauna",
        "cold-plunge": "Cold Plunge",
        "sauna-steam": "Sauna & Steam Room",
        "salt-room": "Salt Room",
        zerobody: "Starpool ZeroBody",
      };
      if (standalone[rs]) return [{ to: `/spa/${rs}`, label: standalone[rs] }];
      return [];
    }) ?? [];

  return (
    <ServiceLandingPage
      title={service.title}
      description={service.description}
      path={path}
      h1={service.h1}
      subhead={service.subhead}
      body={[
        ...service.body,
        `Available in ${durationsLabel}. Book online in under a minute — both members (with tier-based discounts) and guests are welcome.`,
      ]}
      benefits={service.benefits}
      faqs={service.faqs}
      serviceName={service.name}
      ctaHref={`/spa?service=${service.slug}&category=${encodeURIComponent(cat.dbCategory)}`}
      ctaLabel={`Book ${service.name}`}
      eyebrow={cat.name}
      extraBreadcrumbs={[{ label: cat.name, path: `/spa/${cat.slug}` }]}
      relatedHeading={`Other ${cat.name.toLowerCase()} & related services`}
      related={related}
    />
  );
}
