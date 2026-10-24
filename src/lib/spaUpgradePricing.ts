interface Treatment {
  id: string;
  name: string;
  category?: string | null;
  duration_minutes: number;
  price: number;
  member_price?: number | null;
  is_active?: boolean;
}

export function treatmentFamily(name: string): string {
  return name.toLowerCase().replace(/\s*\(extended\)\s*$/, "").replace(/\s*[—–-]\s*\d+\s*(min(?:utes)?)?\s*$/, "").trim();
}

export function findTreatmentDuration(services: Treatment[], name: string, category: string | null | undefined, duration: number) {
  const matches = services.filter(s => s.is_active !== false && s.duration_minutes === duration &&
    (s.category || "").toLowerCase() === (category || "").toLowerCase() && treatmentFamily(s.name) === treatmentFamily(name));
  return matches.length === 1 ? matches[0] : undefined;
}

export function treatmentExtensionCharge(menu: Treatment | undefined, basePrice: number, memberRate: boolean, minutes: number, rate: number) {
  const total = menu ? (memberRate ? menu.member_price ?? menu.price : menu.price) : basePrice + minutes * rate;
  return Math.round((total - basePrice) * 100) / 100;
}