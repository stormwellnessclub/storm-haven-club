import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { spaArrivalNote } from "./spaArrival.ts";

Deno.test("body wrap guests are told to arrive 20–30 minutes early for red light and vibration plate", () => {
  const note = spaArrivalNote("body_wrap");
  assert(note.includes("20–30 minutes early"));
  assert(note.includes("red light"));
  assert(note.includes("vibration plate"));
});

Deno.test("other spa guests keep the 10-minute arrival note", () => {
  assertEquals(spaArrivalNote("massage"), "Please arrive 10 minutes early to settle in.");
  assertEquals(spaArrivalNote(undefined), "Please arrive 10 minutes early to settle in.");
});
