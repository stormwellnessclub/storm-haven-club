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
  expect(rows.find((r) => r.name === "Keziah").status).toBe("yes");
  expect(rows.find((r) => r.name === "Keziah").viaEvent).toBe(true);
  expect(rows.find((r) => r.key === "u:sarah").viaEvent).toBeUndefined();
  expect(rows.find((r) => r.key === "u:lil").status).toBe("none");
});

test("Aya and Ayah's event reservations count as Going once each in Round 1", () => {
  const people = [
    { user_id: "aya", full_name: "Aya Charafeddine", email: "aya@example.org", joined_round_key: null },
    { user_id: "ayah", full_name: "Ayah Abouarabi", email: "ayah@example.org", joined_round_key: null },
  ];
  const rows = buildRoundAttendance("round-1", people, [], people.map((p) => ({ user_id: p.user_id, email: p.email, name: p.full_name })));
  expect(rows).toHaveLength(2);
  expect(rows.filter((r) => r.status === "yes")).toHaveLength(2);
  expect(rows.every((r) => r.viaEvent && r.rounds.includes("round-1"))).toBe(true);
});

test.each(["yes", "maybe", "no", "dismissed"])("explicit %s RSVP takes precedence over an event reservation", (response) => {
  const rows = buildRoundAttendance("round-1", [], [{ user_id: "aya", response, email: "aya@example.org" }], [{ user_id: "aya", email: "aya@example.org" }]);
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe(response);
  expect(rows[0].viaEvent).toBeUndefined();
});
