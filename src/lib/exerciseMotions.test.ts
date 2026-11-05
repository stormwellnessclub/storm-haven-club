import { describe, it, expect } from "bun:test";
import { computeJoints, getExerciseMotion, lerpPose, demoExerciseNames, LEN } from "./exerciseMotions";
import { parseReps, parseRestSeconds, programExercisesToWorkout, createWorkoutState, lastWeightsFor } from "./workoutJournal";

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("exercise demos match exact exercises only", () => {
  it("finds the demo for an exact program name, any capitalisation", () => {
    expect(getExerciseMotion("Technogym BioStrength Leg Curl")?.title).toBe("Seated leg curl");
  });
  it("never substitutes a similar exercise", () => {
    expect(getExerciseMotion("Leg Curl")).toBeNull();
    expect(getExerciseMotion("Lying Leg Curl")).toBeNull();
    expect(getExerciseMotion("Barbell Back Squat")).toBeNull();
  });
  it("keeps every bone the same length through every demo", () => {
    for (const n of demoExerciseNames()) {
      const m = getExerciseMotion(n)!;
      for (const t of [0, 0.5, 1]) {
        const j = computeJoints(lerpPose(m.keys[0], m.keys[1], t), m.anchor);
        expect(dist(j.lShoulder, j.lElbow)).toBeCloseTo(LEN.ua, 5);
        expect(dist(j.lHip, j.lKnee)).toBeCloseTo(LEN.th, 5);
      }
    }
  });
  it("keeps the feet planted on anchored demos", () => {
    const m = getExerciseMotion("Booty Builder Belt Squat Machine")!;
    const a = computeJoints(m.keys[0], m.anchor).lAnkle, b = computeJoints(m.keys[1], m.anchor).lAnkle;
    expect(dist(a, b)).toBeLessThan(1e-9);
  });
});

describe("program workouts in the player", () => {
  it("reads rep ranges and rest text", () => {
    expect(parseReps("8-10")).toBe(8);
    expect(parseRestSeconds("60s")).toBe(60);
    expect(parseRestSeconds("90 seconds")).toBe(90);
    expect(parseRestSeconds("2 min")).toBe(120);
  });
  it("prefills last-time weights and keeps the rep label", () => {
    const ex = programExercisesToWorkout([{ name: "Plank", sets: 2, reps: "8-10", rest: "60s" }]);
    expect(ex[0].repsLabel).toBe("8-10");
    const last = lastWeightsFor([{ exercises: [{ name: "plank", weights_used: [45, 50] }] }], ex);
    const s = createWorkoutState({ templateId: null, name: "Day 1", exercises: ex, programWorkoutId: "pw1", lastWeights: last });
    expect(s.weights[0]).toEqual([45, 50]);
    expect(s.programWorkoutId).toBe("pw1");
  });
});
