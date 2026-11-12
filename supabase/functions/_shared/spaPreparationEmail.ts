// Spa email helpers: per-service intake wording and the preparation block (text comes from spa_services.preparation).
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface PreparationEmail { title: string; items: { heading: string; body: string }[]; linkLabel?: string | null }

/** Full preparation instructions as an email block; empty when the service has none. */
export function preparationHtml(prep: PreparationEmail | null | undefined, linkUrl?: string | null): string {
  if (!prep || !Array.isArray(prep.items) || prep.items.length === 0) return "";
  const rows = prep.items.slice(0, 20).map((i) =>
    `<p style="margin: 0 0 10px 0; color: #4B4537; font-size: 13px; line-height: 1.5;"><strong style="color: #1C170F;">${esc(i.heading)}</strong><br />${esc(i.body)}</p>`).join("");
  const link = linkUrl ? `<p style="margin: 12px 0 0 0; font-size: 13px;"><a href="${esc(linkUrl)}" style="color: #1C170F; text-decoration: underline;">${esc(prep.linkLabel || "View full preparation information")}</a></p>` : "";
  return `<div style="background: #F7F4EE; border-left: 3px solid #88766B; border-radius: 6px; padding: 14px 16px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600; color: #1C170F; font-size: 14px;">${esc(prep.title)}</p>${rows}${link}</div>`;
}

/** Wording for the "complete your forms" parts of spa emails. */
export function intakeCopy(kind?: string | null): { step: string; title: string; body: string; button: string; reminderTitle: string; reminderBody: string } {
  if (kind === "sculpt") return {
    step: "Aella Sculpt intake & consent forms",
    title: "Before your first Aella Sculpt treatment — intake & consent",
    body: "Please complete your Aella Sculpt Health & Treatment Intake and sign your Treatment Consent before your appointment. Your provider reviews them before your first treatment. Progress photography consent is optional.",
    button: "Complete Aella Sculpt Forms",
    reminderTitle: "Your Aella Sculpt forms aren't done yet",
    reminderBody: "Please complete your intake and treatment consent before you arrive so your provider can review them.",
  };
  if (kind === "body_wrap") return {
    step: "Body Wrap intake & consent form",
    title: "Before your body wrap — intake & consent form",
    body: "Spa Aella needs your Body Wrap intake and signed consent before your appointment. It only takes a few minutes.",
    button: "Complete Body Wrap Intake",
    reminderTitle: "Your intake form isn't done yet",
    reminderBody: "Please complete it before you arrive so your therapist can prepare.",
  };
  return {
    step: "intake form",
    title: "Before your session — intake form",
    body: "Please complete your intake form so your therapist can tailor the session (focus areas, pressure, health notes). It only takes a couple of minutes.",
    button: "Complete Intake Form",
    reminderTitle: "Your intake form isn't done yet",
    reminderBody: "Please complete it before you arrive so your therapist can prepare.",
  };
}
