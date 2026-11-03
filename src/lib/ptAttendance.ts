export interface PTAttendanceRow {
  id: string;
  user_id: string;
  checked_in_at: string | null;
  status: string;
  notes?: string | null;
  format?: string;
}

export function checkedInPT(rows: PTAttendanceRow[], start: string, end: string) {
  return rows.filter(row => row.checked_in_at &&
    row.checked_in_at >= start && row.checked_in_at < end &&
    (row.status === "scheduled" || row.status === "completed"));
}

export function countAttendanceTypes(entries: { type: string }[]) {
  return {
    total: entries.length,
    members: entries.filter(e => e.type === "member").length,
    guests: entries.filter(e => e.type === "guest").length,
    classes: entries.filter(e => e.type === "class").length,
    spa: entries.filter(e => e.type === "spa").length,
    pt: entries.filter(e => e.type === "pt").length,
  };
}