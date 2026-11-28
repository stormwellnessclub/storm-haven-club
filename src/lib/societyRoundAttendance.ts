/** One Higher Self Society list per round: roster members of that round, RSVPs and event spots merged once per person. */
export type AttendanceStatus = "yes" | "maybe" | "no" | "dismissed" | "none";
export type AttendanceRow = {
  key: string; name: string; email: string | null; phone: string | null;
  status: AttendanceStatus; rounds: string[]; viaEvent?: boolean;
};
type Interest = { user_id?: string | null; full_name?: string | null; email?: string | null; phone?: string | null; joined_round_key?: string | null };
type Rsvp = { user_id: string; response: string; name?: string | null; email?: string | null; phone?: string | null };
type Spot = { user_id?: string | null; name?: string | null; email?: string | null; phone?: string | null };

export const FIRST_ROUND = "round-1";
export const roundOfInterest = (i: Interest) => i.joined_round_key || FIRST_ROUND;

export function buildRoundAttendance(roundKey: string, roster: Interest[], rsvps: Rsvp[], spots: Spot[]): AttendanceRow[] {
  const rows = new Map<string, AttendanceRow>();
  const alias = new Map<string, string>();
  const find = (uid?: string | null, email?: string | null) => {
    const e = email?.trim().toLowerCase();
    return (uid && alias.get(`u:${uid}`)) || (e && alias.get(`e:${e}`)) || null;
  };
  const upsert = (uid: string | null | undefined, email: string | null | undefined, base: Omit<AttendanceRow, "key" | "rounds">) => {
    const e = email?.trim().toLowerCase() || null;
    let key = find(uid, e);
    if (!key) { key = uid ? `u:${uid}` : `e:${e}`; rows.set(key, { key, ...base, email: base.email, rounds: [] }); }
    const row = rows.get(key);
    if (!row) throw new Error("Attendance row could not be created");
    if (uid) alias.set(`u:${uid}`, key);
    if (e) alias.set(`e:${e}`, key);
    row.name = row.name || base.name; row.email = row.email || base.email; row.phone = row.phone || base.phone;
    return row;
  };
  const roundsByUser = new Map<string, string[]>();
  roster.forEach((i) => {
    const r = roundOfInterest(i);
    const k = i.user_id || i.email?.toLowerCase() || "";
    roundsByUser.set(k, [...(roundsByUser.get(k) ?? []), r]);
  });
  roster.filter((i) => roundOfInterest(i) === roundKey).forEach((i) => {
    upsert(i.user_id, i.email, { name: i.full_name || i.email || "Member", email: i.email ?? null, phone: i.phone ?? null, status: "none" });
  });
  const answered = new Set<string>();
  rsvps.forEach((r) => {
    const row = upsert(r.user_id, r.email, { name: r.name || r.email || "Member", email: r.email ?? null, phone: r.phone ?? null, status: "none" });
    row.status = (["yes", "maybe", "no", "dismissed"].includes(r.response) ? r.response : "none") as AttendanceStatus;
    answered.add(row.key);
  });
  spots.forEach((s) => {
    const row = upsert(s.user_id, s.email, { name: s.name || s.email || "Guest", email: s.email ?? null, phone: s.phone ?? null, status: "none" });
    if (!answered.has(row.key)) { row.status = "yes"; row.viaEvent = true; }
  });
  // Label every round a person belongs to, so someone in Round 1 and Round 2 is clear.
  rows.forEach((row) => {
    const rs = new Set<string>([roundKey]);
    roster.forEach((i) => {
      const e = i.email?.toLowerCase();
      if ((i.user_id && row.key === alias.get(`u:${i.user_id}`)) || (e && row.key === alias.get(`e:${e}`))) rs.add(roundOfInterest(i));
    });
    row.rounds = [...rs].sort();
  });
  return [...rows.values()];
}

const ORDER: AttendanceStatus[] = ["yes", "maybe", "no", "dismissed", "none"];
export const sortAttendance = (rows: AttendanceRow[]) =>
  [...rows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
