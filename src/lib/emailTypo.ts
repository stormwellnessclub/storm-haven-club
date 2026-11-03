// Suggests a correction for common email domain typos (e.g. "gmail.co" -> "gmail.com").
const FIXES: Record<string, string> = {
  "gmail.co": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com",
  "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com", "gmaill.com": "gmail.com", "yahoo.co": "yahoo.com", "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com", "hotmail.co": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com",
  "outlook.co": "outlook.com", "outlok.com": "outlook.com", "icloud.co": "icloud.com", "iclod.com": "icloud.com",
  "icloud.con": "icloud.com", "aol.co": "aol.com", "comcast.ne": "comcast.net",
};

export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return null;
  const domain = trimmed.slice(at + 1).toLowerCase();
  const fix = FIXES[domain];
  return fix ? `${trimmed.slice(0, at)}@${fix}` : null;
}
