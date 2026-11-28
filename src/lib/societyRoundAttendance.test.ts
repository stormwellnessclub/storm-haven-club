// @ts-nocheck
import { expect, test } from "bun:test";
import { buildRoundAttendance } from "./societyRoundAttendance";

const roster = [
  { user_id: "sarah", full_name: "Sarah K", email: "s@x.org", joined_round_key: null },
  { user_id: "shams", full_name: "Shams A", email: "sh@x.org", joined_round_key: "round-2" },
  { user_id: "noor", full_name: "Noor J", email: "n@x.org", joined_round_key: "round-2" },
  { user_id: "lil", full_name: "Lilian C", email: "l@x.org", joined_round_key: null },
];

test("a Round 2-only person is not on the Round 1 list", () => {
  const rows = buildRoundAttendance("round-1", roster, [{ user_id: "sarah", response: "yes" }], []);
  expect(rows.find((r) => r.key === "u:shams")).toBeUndefined();
});

test("someone who RSVP'd is listed with their answer even if they joined a later round", () => {
  const rows = buildRoundAttendance("round-1", roster, [{ user_id: "noor", response: "yes" }], []);
  const noor = rows.find((r) => r.key === "u:noor");
  expect(noor.status).toBe("yes");
  expect(noor.rounds).toEqual(["round-1", "round-2"]);
});

test("an event spot holder appears once, and an RSVP answer wins over the spot", () => {
  const rows = buildRoundAttendance("round-1", roster,
    [{ user_id: "sarah", response: "yes" }],
    [{ user_id: null, email: "S@X.org", name: "Sarah K" }, { email: "k@x.org", name: "Keziah" }]);
  expect(rows.filter((r) => r.email?.toLowerCase() === "s@x.org").length).toBe(1);
  expect(rows.find((r) => r.key === "u:sarah").status).toBe("yes");
  expect(rows.find((r) => r.name === "Keziah").status).toBe("spot");
  expect(rows.find((r) => r.key === "u:lil").status).toBe("none");
});
