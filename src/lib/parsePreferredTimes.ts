/**
 * Parses the free-text "preferred times" note on a training request into
 * structured days of week and readable time chips.
 *
 * Deliberately conservative: if nothing recognisable is found we report
 * `parsed: false` so the UI can fall back to showing the raw text.
 */

export type TimeBucket = "morning" | "midday" | "evening";

export interface ParsedPreferredTimes {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** Human readable time fragments, e.g. ["8:00 AM", "After 4:00 PM"] */
  timeChips: string[];
  /** Buckets the request touches */
  buckets: TimeBucket[];
  parsed: boolean;
  raw: string;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Order matters: longer tokens first so "thursday" wins over "thu"/"t".
const DAY_TOKENS: Array<[RegExp, number]> = [
  [/\bsundays?\b|\bsun\b/g, 0],
  [/\bmondays?\b|\bmon\b/g, 1],
  [/\btuesdays?\b|\btues\b|\btue\b/g, 2],
  [/\bwednesdays?\b|\bweds\b|\bwed\b/g, 3],
  [/\bthursdays?\b|\bthurs\b|\bthur\b|\bthu\b/g, 4],
  [/\bfridays?\b|\bfri\b/g, 5],
  [/\bsaturdays?\b|\bsat\b/g, 6],
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

/** "monday - saturday", "mon-fri", "m-f" */
const RANGE_RE =
  /\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\s*(?:-|–|—|\bto\b|\bthru\b|\bthrough\b)\s*(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/g;

function dayIndexFromWord(word: string): number | null {
  const w = word.toLowerCase();
  for (const [re, idx] of DAY_TOKENS) {
    const single = new RegExp(re.source, "i");
    if (single.test(w)) return idx;
  }
  return null;
}

/** Handles compact letter lists like "M,W,F" or "W F mornings" */
function parseLetterList(text: string): number[] {
  const found = new Set<number>();
  const letterMap: Record<string, number> = { m: 1, w: 3, f: 5, r: 4, u: 0 };
  // Only treat single letters as days when comma/slash separated or space
  // separated in a short cluster, to avoid false positives from prose.
  const clusters = text.match(/\b(?:[mtwrfsu])(?:\s*[,/&+ ]\s*[mtwrfsu])+\b/gi) ?? [];
  for (const cluster of clusters) {
    for (const ch of cluster.toLowerCase().replace(/[^a-z]/g, "")) {
      if (letterMap[ch] !== undefined) found.add(letterMap[ch]);
      else if (ch === "t") found.add(2);
      else if (ch === "s") found.add(6);
    }
  }
  return [...found];
}

function fmtTime(hour: number, minute: number, meridiemHint?: string): string {
  let h = hour;
  let suffix = meridiemHint?.toUpperCase().replace(/\./g, "");
  if (suffix === "A") suffix = "AM";
  if (suffix === "P") suffix = "PM";
  if (!suffix) {
    // No am/pm given: 1–5 most likely PM in a gym context, 6–11 AM.
    suffix = h >= 1 && h <= 5 ? "PM" : "AM";
  }
  if (h === 0) h = 12;
  if (h > 12) {
    h -= 12;
    suffix = "PM";
  }
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function bucketForLabel(label: string): TimeBucket | null {
  const m = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  if (h < 11) return "morning";
  if (h < 15) return "midday";
  return "evening";
}

export function parsePreferredTimes(raw: string | null | undefined): ParsedPreferredTimes {
  const text = (raw ?? "").trim();
  const empty: ParsedPreferredTimes = {
    days: [],
    timeChips: [],
    buckets: [],
    parsed: false,
    raw: text,
  };
  if (!text) return empty;

  const lower = text.toLowerCase();
  const days = new Set<number>();

  // Ranges first
  let rm: RegExpExecArray | null;
  RANGE_RE.lastIndex = 0;
  while ((rm = RANGE_RE.exec(lower)) !== null) {
    const start = dayIndexFromWord(rm[1]);
    const end = dayIndexFromWord(rm[2]);
    if (start !== null && end !== null) {
      let i = start;
      for (let guard = 0; guard < 7; guard++) {
        days.add(i);
        if (i === end) break;
        i = (i + 1) % 7;
      }
    }
  }

  // Named days
  for (const [re, idx] of DAY_TOKENS) {
    const test = new RegExp(re.source, "gi");
    if (test.test(lower)) days.add(idx);
  }

  // Group words
  if (/\bweek\s?days?\b|\bweek days\b/.test(lower)) WEEKDAYS.forEach((d) => days.add(d));
  if (/\bweek\s?ends?\b/.test(lower)) WEEKEND.forEach((d) => days.add(d));
  if (/\bevery ?day\b|\bany ?day\b|\bdaily\b|\ball week\b/.test(lower))
    [0, 1, 2, 3, 4, 5, 6].forEach((d) => days.add(d));

  // Compact letter lists
  if (days.size === 0) parseLetterList(lower).forEach((d) => days.add(d));

  // Times
  const chips: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    if (!seen.has(label)) {
      seen.add(label);
      chips.push(label);
    }
  };

  const TIME_RE =
    /\b(after|before|around|from|starting)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/gi;
  let tm: RegExpExecArray | null;
  while ((tm = TIME_RE.exec(lower)) !== null) {
    const prefix = tm[1];
    const rawHour = tm[2];
    const rawMin = tm[3];
    const mer = tm[4];
    let hour = parseInt(rawHour, 10);
    let minute = rawMin ? parseInt(rawMin, 10) : 0;

    // "530" style compact times
    if (!rawMin && !mer && rawHour.length === 3) {
      hour = parseInt(rawHour.slice(0, 1), 10);
      minute = parseInt(rawHour.slice(1), 10);
    } else if (!rawMin && !mer && rawHour.length === 4) {
      hour = parseInt(rawHour.slice(0, 2), 10);
      minute = parseInt(rawHour.slice(2), 10);
    } else if (!mer && !rawMin && hour > 12) {
      continue; // "3-4 times", counts, etc.
    } else if (!mer && !rawMin && !prefix) {
      // A bare small number with no am/pm and no qualifier is ambiguous
      // ("3-4 times a week"). Skip unless the sentence mentions time words.
      if (!/\b(am|pm|o'?clock|morning|evening|afternoon|noon)\b/.test(lower)) continue;
    }
    if (hour > 23 || minute > 59) continue;

    const label = fmtTime(hour, minute, mer);
    push(prefix === "after" ? `After ${label}` : prefix === "before" ? `Before ${label}` : label);
  }

  if (/\bmornings?\b|\bearly\b|\bam\b(?!\s*\d)/.test(lower) && !chips.length) push("Mornings");
  else if (/\bmornings?\b/.test(lower)) push("Mornings");
  if (/\bafternoons?\b|\bmid ?day\b|\bnoon\b/.test(lower)) push("Afternoons");
  if (/\bevenings?\b|\bnights?\b|\blate\b/.test(lower)) push("Evenings");

  const buckets = new Set<TimeBucket>();
  for (const c of chips) {
    if (/mornings/i.test(c)) buckets.add("morning");
    else if (/afternoons/i.test(c)) buckets.add("midday");
    else if (/evenings/i.test(c)) buckets.add("evening");
    else {
      const b = bucketForLabel(c);
      if (b) buckets.add(b);
    }
  }

  const dayList = [...days].sort((a, b) => a - b);
  return {
    days: dayList,
    timeChips: chips,
    buckets: [...buckets],
    parsed: dayList.length > 0 || chips.length > 0,
    raw: text,
  };
}

export function formatDays(days: number[]): string {
  if (!days.length) return "—";
  if (days.length === 7) return "Any day";
  return days.map((d) => DAY_LABELS[d]).join(", ");
}

export const BUCKET_LABEL: Record<TimeBucket, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
};
