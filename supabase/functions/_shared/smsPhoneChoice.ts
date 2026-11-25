/** OptOutType is authoritative when Twilio's Advanced Opt-Out handled the reply. */
export function smsPhoneChoice(body: string, optOutType: string | null): boolean | null {
  const carrier = (optOutType ?? "").toUpperCase();
  if (carrier === "STOP") return false;
  if (carrier === "START") return true;
  if (carrier === "HELP") return null;
  const keyword = body.trim().toUpperCase().split(/\s+/)[0];
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) return false;
  if (["START", "UNSTOP", "YES", "JOIN", "SUBSCRIBE"].includes(keyword)) return true;
  return null;
}
