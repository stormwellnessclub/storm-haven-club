export function checkoutSessionFromSearch(search: string): string | null {
  // Older checkout URLs appended a second '?' after purchase=success.
  return new URLSearchParams(search.replace(/\?(?=session_id=)/g, "&")).get("session_id");
}

export { classPassSuccessUrl } from "../../supabase/functions/_shared/classPassCheckoutUrl";

export interface ClassPaymentSelection {
  paymentMethod: "credits" | "pass";
  selectedPassId: string | null;
  selectedPassType: string | null;
}

export function reconcileClassPayment(
  current: ClassPaymentSelection,
  hasCredits: boolean,
  passes: { id: string; pass_type: string }[],
): ClassPaymentSelection {
  const selected = passes.find(pass => pass.id === current.selectedPassId);
  if (current.paymentMethod === "pass" && selected) return { ...current, selectedPassType: selected.pass_type };
  if (current.paymentMethod === "credits" && hasCredits) return current;
  if (hasCredits) return { paymentMethod: "credits", selectedPassId: null, selectedPassType: null };
  const pass = passes[0];
  return pass
    ? { paymentMethod: "pass", selectedPassId: pass.id, selectedPassType: pass.pass_type }
    : { paymentMethod: "credits", selectedPassId: null, selectedPassType: null };
}