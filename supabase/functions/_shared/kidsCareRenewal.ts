const KIDS_CARE_PRICE = "price_1TCEyxLyZrsSqLhsHLRDNixO";

type InvoiceLine = {
  price?: { id?: string } | null;
  pricing?: { price_details?: { price?: string | { id?: string } } };
  period?: { start?: number; end?: number };
};

export function kidsCareRenewalPeriod(invoice: { lines?: { data?: InvoiceLine[] } }) {
  const line = invoice.lines?.data?.find((item) => {
    const modernPrice = item.pricing?.price_details?.price;
    const priceId = item.price?.id ?? (typeof modernPrice === "string" ? modernPrice : modernPrice?.id);
    return priceId === KIDS_CARE_PRICE;
  });
  if (!line?.period?.start || !line.period.end) return null;
  return {
    purchasedAt: new Date(line.period.start * 1000).toISOString(),
    expiresAt: new Date(line.period.end * 1000).toISOString(),
  };
}