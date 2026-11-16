/**
 * Groups PT activity per trainer hour so staff see one plain label per hour:
 * "Requested · 1 waiting", "Booked · 2 waiting" or (gold) "Opened · 1 waiting".
 * Rule: the first request holds the hour; later people wait in the order they joined.
 */
export type SlotHold = { id: string; trainer_id: string | null; starts_at: string; client_name: string | null; request_status: string; session_name: string | null };
export type SlotBooked = { id: string; instructor_id: string | null; starts_at: string; duration_minutes: number; status: string; client_name?: string | null };
export type SlotWaiter = { id: string; trainer_id: string; preferred_date: string; preferred_time: string; created_at: string; client_name: string | null; status: string; session_name?: string | null; phone?: string | null; email?: string | null; notes?: string | null; client_user_id?: string };

export type SlotState = "booked" | "requested" | "opened";
export type SlotSummary = {
  key: string; trainer_id: string; starts_at: string; state: SlotState;
  booked: SlotBooked[]; requests: SlotHold[]; waiting: SlotWaiter[]; label: string;
};

export const slotKey = (trainerId: string, startsAt: string) => `${trainerId}|${new Date(startsAt).getTime()}`;
export const waiterStartsAt = (w: Pick<SlotWaiter, "preferred_date" | "preferred_time">) =>
  new Date(`${w.preferred_date}T${w.preferred_time.slice(0, 8)}`).toISOString();

export function slotLabel(state: SlotState, waiting: number): string {
  const head = state === "booked" ? "Booked" : state === "requested" ? "Requested" : "Opened";
  return waiting > 0 ? `${head} · ${waiting} waiting` : head;
}

/** One summary per trainer hour that has people waiting. Waiters are ordered oldest first. */
export function buildWaitlistSlots(holds: SlotHold[], booked: SlotBooked[], waiters: SlotWaiter[]): SlotSummary[] {
  const groups = new Map<string, SlotWaiter[]>();
  for (const w of waiters) {
    const k = slotKey(w.trainer_id, waiterStartsAt(w));
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  const out: SlotSummary[] = [];
  for (const [key, list] of groups) {
    const trainer_id = list[0].trainer_id;
    const starts_at = waiterStartsAt(list[0]);
    const t = new Date(starts_at).getTime();
    const b = booked.filter((a) => a.status === "scheduled" && a.instructor_id === trainer_id
      && new Date(a.starts_at).getTime() <= t && new Date(a.starts_at).getTime() + a.duration_minutes * 60000 > t);
    const r = holds.filter((h) => h.trainer_id === trainer_id && Math.abs(new Date(h.starts_at).getTime() - t) < 60 * 60000);
    const state: SlotState = b.length ? "booked" : r.length ? "requested" : "opened";
    const waiting = [...list].sort((a, z) => a.created_at.localeCompare(z.created_at));
    out.push({ key, trainer_id, starts_at, state, booked: b, requests: r, waiting, label: slotLabel(state, waiting.length) });
  }
  return out.sort((a, z) => a.starts_at.localeCompare(z.starts_at));
}
