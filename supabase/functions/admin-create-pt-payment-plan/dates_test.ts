import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { addOneMonth } from "./dates.ts";
Deno.test("Linda: payment 1 Jan 24 means payment 2 Feb 24", () => assertEquals(addOneMonth("2027-01-24"), "2027-02-24"));
Deno.test("Latife: payment 1 Jun 1 means payment 2 Jul 1", () => assertEquals(addOneMonth("2027-06-01"), "2027-07-01"));
Deno.test("month end clamps", () => assertEquals(addOneMonth("2027-01-31"), "2027-02-28"));
Deno.test("December rolls the year", () => assertEquals(addOneMonth("2026-12-15"), "2027-01-15"));
