/** Public addresses for the Spa Aella pages. Old /spa/preview links redirect to these. */
export const SPA_PATHS = {
  home: "/spa",
  sculpt: "/spa/aella-sculpt",
  sculptBook: "/spa/aella-sculpt#book",
  sculptPreparation: "/spa/aella-sculpt/preparation",
  facial: (slug: string) => `/spa/treatments/facials/${slug}`,
  /** Opens the appointment-request form on the Spa page for one treatment. */
  request: (serviceName: string) => `/spa?request=${encodeURIComponent(serviceName)}`,
} as const;
