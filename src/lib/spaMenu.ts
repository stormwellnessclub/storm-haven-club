interface MenuService { category: string; name: string; display_order: number; }

export function spaMenuMode(service: Pick<MenuService, "category" | "name">): "book" | "request" | "soon" {
  if (/ozone/i.test(service.name) || service.category === "Facials") return "request";
  if (["Massage", "Body Wraps", "Recovery"].includes(service.category)) return "book";
  return "soon";
}

export function orderedSpaMenu<T extends MenuService>(services: T[], category: string): T[] {
  const priority = { book: 0, request: 1, soon: 2 };
  return services.filter(s => category === "All" ? s.category !== "Body Rituals" : s.category === category)
    .sort((a, b) => priority[spaMenuMode(a)] - priority[spaMenuMode(b)] || a.display_order - b.display_order);
}