/** Persist opt-outs before reporting success; receipts and account data are untouched. */
export async function recordEmailPreference(db: any, email: string, resubscribe: boolean) {
  const normalized = email.trim().toLowerCase();
  const { data: rows, error: readError } = await db.from("marketing_contacts").select("id").ilike("email", normalized);
  if (readError) throw new Error("Could not read email preference");
  const values = { opted_in_email: resubscribe, unsubscribed_at: resubscribe ? null : new Date().toISOString() };
  const result = rows?.length
    ? await db.from("marketing_contacts").update(values).ilike("email", normalized)
    : await db.from("marketing_contacts").insert({ email: normalized, source: "manual", source_label: "Email preference link", ...values });
  if (result.error) throw new Error("Could not save email preference");
}