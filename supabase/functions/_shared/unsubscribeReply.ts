// Detects replies to club emails that only ask to be taken off the list, so they are
// recorded as an unsubscribe by the system instead of landing in the admin inbox.

const QUOTE_START = /^(>|on .+wrote:?$|-{2,}\s*original message|from:\s|sent from my )/i;
const REQUEST = /^(please\s+)?(unsubscribe|stop|remove|opt[\s-]?out|take me off)(\s+me)?(\s+(from|off)(\s+(your|the|this))?(\s+(mailing|email))?\s+(list|emails?))?(\s+please)?[\s.!]*$/i;

const stripHtml = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ");

/** The new text someone typed, without the quoted email below it. */
export function replyText(body: string): string {
  const lines = stripHtml(String(body ?? "")).split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (QUOTE_START.test(line)) break;
    if (line) out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function isUnsubscribeReply(subject: string, body: string): boolean {
  const text = replyText(body);
  if (text && text.length <= 80 && REQUEST.test(text)) return true;
  const subj = String(subject ?? "").replace(/^(re|fw|fwd):\s*/gi, "").trim();
  return !text && REQUEST.test(subj);
}
