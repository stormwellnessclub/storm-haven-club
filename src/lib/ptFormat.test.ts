// @ts-nocheck
import { expect, test } from "bun:test";
import { buildMemberPriceRows, isNonMemberPack } from "./ptFormat";

const pack = (name, sessions, price_cents) => ({ id: name, name, sessions, price_cents, expiration_days: 60, format: "semi_private" });

test("member and non-member Semi-Private packs line up by session count", () => {
  const rows = buildMemberPriceRows([
    pack("10-Pack", 10, 55000),
    pack("10 Pack", 10, 55000),
    pack("Non-Member 10-Pack", 10, 60000),
    pack("80 Pack", 80, 360000),
    pack("Non-Member 80-Pack", 80, 400000),
  ]);
  expect(rows.map((r) => [r.sessions, r.member?.price_cents, r.nonMember?.price_cents])).toEqual([
    [10, 55000, 60000],
    [80, 360000, 400000],
  ]);
});

test("formats without non-member packs use the plain list", () => {
  expect(buildMemberPriceRows([pack("Single Session", 1, 12000), pack("One on One with Storm", 1, 15000)])).toBeNull();
});

test("non-member packs are recognised by name", () => {
  expect(isNonMemberPack({ name: "Non-Member 45-Pack" })).toBe(true);
  expect(isNonMemberPack({ name: "45-Pack" })).toBe(false);
});
