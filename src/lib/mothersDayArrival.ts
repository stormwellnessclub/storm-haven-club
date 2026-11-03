export function isMothersDayVoucher(appt: { payment_method?: string | null } | null | undefined): boolean {
  return appt?.payment_method === "mothers_day_voucher";
}
