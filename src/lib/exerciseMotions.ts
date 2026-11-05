/**
 * 3D exercise demos. Each demo is authored for ONE exact exercise name and is
 * never reused for a different exercise. Unknown names return null so the UI
 * shows no animation rather than a stand-in.
 */
export type V = [number, number, number];

export interface Pose {
  pelvis: V;
  /** Torso tilt from vertical in degrees; positive leans forward, negative leans back. */
  lean: number;
  twist?: number;
  ua: V; fa: V; th: V; sh: V;
  /** Arm directions are given relative to the torso instead of the room. */
  armsInTorso?: boolean;
}

export type HandProp = "dumbbell" | "bar" | "handle" | "vhandle" | "ball" | "plate" | "wheel" | "none";
export interface StaticProp { shape: "box" | "sphere"; p: V; s: V; rx?: number; tone?: "pad" | "frame" }

export interface ExerciseMotion {
  title: string;
  /** Short cue shown under the demo. */
  cue: string;
  keys: [Pose, Pose];
  /** seconds: lift, pause at top, lower, pause at bottom */
  tempo?: [number, number, number, number];
  hands?: HandProp;
  ankles?: "roller" | "none";
  anchor?: { joint: "lAnkle" | "lKnee"; at: V };
  props?: StaticProp[];
  cam?: V; target?: V;
  hold?: boolean;
}

export const LEN = { chest: 0.45, neck: 0.53, head: 0.66, shoulder: 0.18, hip: 0.1, ua: 0.29, fa: 0.27, th: 0.43, sh: 0.42, foot: 0.14 };

const norm = (v: V): V => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const rad = (d: number) => (d * Math.PI) / 180;
export const rotX = (v: V, d: number): V => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
export const rotY = (v: V, d: number): V => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
const mirror = (v: V): V => [-v[0], v[1], v[2]];

export type Joints = Record<
  "pelvis" | "chest" | "neck" | "head" | "lShoulder" | "rShoulder" | "lElbow" | "rElbow" | "lHand" | "rHand" |
  "lHip" | "rHip" | "lKnee" | "rKnee" | "lAnkle" | "rAnkle" | "lToe" | "rToe", V>;

/** Joint positions for a pose; bone lengths are always kept exact. */
export function computeJoints(p: Pose, anchor?: ExerciseMotion["anchor"]): Joints {
  const torsoFrame = (v: V) => rotX(rotY(v, p.twist ?? 0), p.lean);
  const up = torsoFrame([0, 1, 0]);
  const line = torsoFrame([1, 0, 0]);
  const P = p.pelvis;
  const chest = add(P, up, LEN.chest);
  const armDir = (v: V) => norm(p.armsInTorso ? torsoFrame(v) : v);
  const side = (s: 1 | -1) => {
    const m = (v: V) => (s === 1 ? v : mirror(v));
    const S = add(chest, line, LEN.shoulder * s);
    const E = add(S, armDir(m(p.ua)), LEN.ua);
    const H = add(E, armDir(m(p.fa)), LEN.fa);
    const hip = add(P, [LEN.hip * s, 0, 0]);
    const shin = norm(m(p.sh));
    const K = add(hip, norm(m(p.th)), LEN.th);
    const A = add(K, shin, LEN.sh);
    const T = add(A, norm(rotX(shin, -90)), LEN.foot);
    return { S, E, H, hip, K, A, T };
  };
  const l = side(1), r = side(-1);
  let j: Joints = {
    pelvis: P, chest, neck: add(P, up, LEN.neck), head: add(P, up, LEN.head),
    lShoulder: l.S, rShoulder: r.S, lElbow: l.E, rElbow: r.E, lHand: l.H, rHand: r.H,
    lHip: l.hip, rHip: r.hip, lKnee: l.K, rKnee: r.K, lAnkle: l.A, rAnkle: r.A, lToe: l.T, rToe: r.T,
  };
  if (anchor) {
    const cur = j[anchor.joint];
    const d: V = [anchor.at[0] - cur[0], anchor.at[1] - cur[1], anchor.at[2] - cur[2]];
    j = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, add(v as V, d)])) as Joints;
  }
  return j;
}

const lerpV = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    pelvis: lerpV(a.pelvis, b.pelvis, t), lean: a.lean + (b.lean - a.lean) * t,
    twist: (a.twist ?? 0) + ((b.twist ?? 0) - (a.twist ?? 0)) * t,
    ua: lerpV(a.ua, b.ua, t), fa: lerpV(a.fa, b.fa, t), th: lerpV(a.th, b.th, t), sh: lerpV(a.sh, b.sh, t),
    armsInTorso: a.armsInTorso,
  };
}

/** 0..1 blend between the two key poses at time `sec`. */
export function motionPhase(m: ExerciseMotion, sec: number): number {
  const [up, top, down, bottom] = m.tempo ?? [1.2, 0.5, 1.8, 0.5];
  const total = up + top + down + bottom;
  const t = ((sec % total) + total) % total;
  const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
  if (t < up) return ease(t / up);
  if (t < up + top) return 1;
  if (t < up + top + down) return 1 - ease((t - up - top) / down);
  return 0;
}

// ---------- shared pieces (equipment shapes only; every exercise has its own motion) ----------
const D: V = [0, -1, 0];
const seat = (y = 0.5, z = 0.05): StaticProp => ({ shape: "box", p: [0, y - 0.04, z], s: [0.42, 0.07, 0.42], tone: "pad" });
const back = (y = 0.5, rx = -10, z = -0.2): StaticProp => ({ shape: "box", p: [0, y + 0.32, z], s: [0.4, 0.62, 0.07], rx, tone: "pad" });
const frame = (p: V, s: V, rx = 0): StaticProp => ({ shape: "box", p, s, rx, tone: "frame" });
const pad = (p: V, s: V, rx = 0): StaticProp => ({ shape: "box", p, s, rx, tone: "pad" });
const feetAt = (z = 0, y = 0.08): ExerciseMotion["anchor"] => ({ joint: "lAnkle", at: [0.1, y, z] });
const seatedLegs = { th: [0, 0, 1] as V, sh: D };
const standLegs = { th: [0, -1, 0.02] as V, sh: D };

const seatedLegCurl: ExerciseMotion = {
  title: "Seated leg curl", cue: "Thighs stay pinned under the pad. Curl the heels down and under, then return slowly.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: -12, ua: [0.25, -1, 0.2], fa: [0.1, -0.2, 1], th: [0, 0, 1], sh: [0, -0.3, 1] },
    { pelvis: [0, 0.55, 0], lean: -12, ua: [0.25, -1, 0.2], fa: [0.1, -0.2, 1], th: [0, 0, 1], sh: [0, -1, -0.45] },
  ],
  ankles: "roller",
  props: [seat(0.55), back(0.55, -14, -0.22), pad([0, 0.68, 0.3], [0.42, 0.06, 0.16])],
};

const legExtension: ExerciseMotion = {
  title: "Leg extension", cue: "Back against the pad. Straighten the knees fully, pause, then lower under control.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: -14, ua: [0.25, -1, 0.15], fa: [0.1, -0.3, 1], ...seatedLegs, sh: [0, -1, -0.12] },
    { pelvis: [0, 0.55, 0], lean: -14, ua: [0.25, -1, 0.15], fa: [0.1, -0.3, 1], th: [0, 0, 1], sh: [0, -0.08, 1] },
  ],
  ankles: "roller", props: [seat(0.55), back(0.55, -16, -0.22)],
};

const hackSquat: ExerciseMotion = {
  title: "Hack squat", cue: "Back flat on the pad, feet shoulder-width on the platform. Sit down until thighs are parallel, drive up through the whole foot.",
  keys: [
    { pelvis: [0, 1, 0], lean: -18, ua: [0.1, -0.6, 0.55], fa: [0, 1, 0.15], th: [0, -1, 0.06], sh: [0, -1, -0.02] },
    { pelvis: [0, 1, 0], lean: -18, ua: [0.1, -0.6, 0.55], fa: [0, 1, 0.15], th: [0, -0.2, 1], sh: [0, -1, 0.5] },
  ].reverse() as [Pose, Pose],
  anchor: feetAt(0.15), tempo: [1.4, 0.4, 2, 0.4],
  props: [frame([0, 0.04, 0.2], [0.7, 0.06, 0.5], 18)],
};

const beltSquat: ExerciseMotion = {
  title: "Belt squat", cue: "Belt around the hips, chest tall, hands on the rail. Sit straight down, then stand by driving the hips up.",
  keys: [
    { pelvis: [0, 1, 0], lean: 14, ua: [0.05, -0.55, 0.85], fa: [0, -0.15, 1], th: [0, -0.3, 1], sh: [0, -1, 0.45] },
    { pelvis: [0, 1, 0], lean: 3, ua: [0.05, -0.75, 0.65], fa: [0, -0.4, 1], ...standLegs },
  ],
  hands: "handle", anchor: feetAt(0), tempo: [1.4, 0.4, 1.8, 0.4],
  props: [frame([0, 0.04, 0], [0.7, 0.06, 0.55]), frame([0, 0.95, 0.65], [0.8, 0.05, 0.05])],
};

const hipThrust: ExerciseMotion = {
  title: "Hip thrust", cue: "Upper back on the pad, chin tucked. Drive the hips up until body is level from shoulders to knees, squeeze, lower slowly.",
  keys: [
    { pelvis: [0, 0.3, 0], lean: -74, ua: [0.3, -0.5, 1], fa: [0.1, -0.6, 1], th: [0, 0.55, 0.83], sh: [0, -1, -0.3] },
    { pelvis: [0, 0.3, 0], lean: -86, ua: [0.3, -0.2, 1], fa: [0.1, -0.5, 1], th: [0, 0.03, 1], sh: [0, -1, -0.05] },
  ],
  anchor: feetAt(0.55), tempo: [1, 0.8, 1.6, 0.3],
  props: [pad([0, 0.36, -0.25], [0.5, 0.1, 0.22]), frame([0, 0.35, 0.1], [0.75, 0.05, 0.05])],
  cam: [2.4, 1.1, 1.4], target: [0, 0.4, 0.1],
};

const reverseFly: ExerciseMotion = {
  title: "Reverse fly", cue: "Chest against the pad, arms long. Open the arms wide to shoulder height, squeeze between the shoulder blades, return slowly.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: 8, ua: [-0.05, -0.05, 1], fa: [-0.05, -0.05, 1], ...seatedLegs },
    { pelvis: [0, 0.55, 0], lean: 8, ua: [1, -0.05, 0.12], fa: [1, -0.05, 0.12], ...seatedLegs },
  ],
  hands: "handle", props: [seat(0.55), pad([0, 0.9, 0.24], [0.36, 0.5, 0.08], 8)], cam: [-1.8, 1.8, 2.4],
};

const pecFly: ExerciseMotion = {
  title: "Pec fly", cue: "Back on the pad, slight bend in the elbows. Bring the handles together in front of the chest, then open slowly.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: -6, ua: [1, -0.05, 0.15], fa: [1, 0, 0.25], ...seatedLegs },
    { pelvis: [0, 0.55, 0], lean: -6, ua: [0.25, -0.05, 1], fa: [-0.45, 0, 1], ...seatedLegs },
  ],
  hands: "handle", props: [seat(0.55), back(0.55, -6)], cam: [1.4, 2, 2.4],
};

const latPulldown: ExerciseMotion = {
  title: "Lat pulldown", cue: "Thighs under the pad, chest lifted. Pull the bar to the upper chest leading with the elbows, then let the arms rise fully.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: -10, ua: [0.45, 1, 0.08], fa: [0.2, 1, 0.05], ...seatedLegs },
    { pelvis: [0, 0.55, 0], lean: -14, ua: [1, -0.75, -0.15], fa: [0.15, 1, 0.1], ...seatedLegs },
  ],
  hands: "bar", props: [seat(0.55), pad([0, 0.72, 0.3], [0.42, 0.06, 0.12])], cam: [1.8, 1.4, 2.6], target: [0, 1, 0],
};

const tricepMachine: ExerciseMotion = {
  title: "Arm (triceps) extension", cue: "Elbows resting on the pad. Straighten the arms fully, pause, then bend back without lifting the elbows.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: 0, ua: [0.05, -0.45, 0.9], fa: [0, 0.95, -0.1], ...seatedLegs },
    { pelvis: [0, 0.55, 0], lean: 0, ua: [0.05, -0.45, 0.9], fa: [0.05, -0.45, 0.9], ...seatedLegs },
  ],
  hands: "handle", props: [seat(0.55), pad([0, 0.88, 0.3], [0.5, 0.06, 0.24], -25)], cam: [2.2, 1.5, 1.6],
};

const loadedBackExt: ExerciseMotion = {
  title: "Loaded back extension", cue: "Hips on the pad, plate held to the chest. Lower with a long spine, then lift until body is in line with the legs.",
  keys: [
    { pelvis: [0, 0.9, 0], lean: 150, ua: [0, -0.3, 0.8], fa: [-0.7, 0.4, 0.3], armsInTorso: true, th: [0, -0.7, -0.7], sh: [0, -0.7, -0.7] },
    { pelvis: [0, 0.9, 0], lean: 45, ua: [0, -0.3, 0.8], fa: [-0.7, 0.4, 0.3], armsInTorso: true, th: [0, -0.7, -0.7], sh: [0, -0.7, -0.7] },
  ],
  hands: "plate", anchor: feetAt(-0.55, 0.12), tempo: [1.3, 0.6, 1.8, 0.3],
  props: [pad([0, 0.64, 0.14], [0.45, 0.08, 0.26], -45), frame([0, 0.06, -0.62], [0.5, 0.05, 0.3], -45)],
  cam: [2.6, 1.3, 0.6], target: [0, 0.7, 0],
};

const seatedRow: ExerciseMotion = {
  title: "Seated cable row", cue: "Sit tall, knees soft. Pull the handle to the stomach, elbows close and back, then reach forward with control.",
  keys: [
    { pelvis: [0, 0.5, 0], lean: 18, ua: [-0.15, -0.1, 1], fa: [-0.12, -0.05, 1], th: [0, 0.08, 1], sh: [0, -0.8, 0.6] },
    { pelvis: [0, 0.5, 0], lean: -6, ua: [0.15, -0.6, -0.65], fa: [-0.2, 0.05, 1], th: [0, 0.08, 1], sh: [0, -0.8, 0.6] },
  ],
  hands: "vhandle", props: [seat(0.5, -0.05), frame([0, 0.25, 0.95], [0.5, 0.45, 0.06], -20)], cam: [2.6, 1.3, 1.2],
};

const dbShoulderPressSeated: ExerciseMotion = {
  title: "Seated dumbbell shoulder press", cue: "Back against the bench, dumbbells at shoulder height. Press overhead without arching, then lower to the start.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: -4, ua: [1, -0.15, 0.15], fa: [0.02, 1, 0.05], ...seatedLegs },
    { pelvis: [0, 0.55, 0], lean: -4, ua: [0.35, 1, 0.08], fa: [0.1, 1, 0.02], ...seatedLegs },
  ],
  hands: "dumbbell", props: [seat(0.55), back(0.55, -4)], target: [0, 0.95, 0],
};

const abBallCrunch: ExerciseMotion = {
  title: "Pilates ab ball crunch", cue: "Ball under the lower back, feet down, hands supporting the head. Curl the ribs toward the hips, then lower slowly.",
  keys: [
    { pelvis: [0, 0.2, 0], lean: -88, ua: [1, 0.5, 0], fa: [-0.8, 0.5, -0.3], armsInTorso: true, th: [0, 0.6, 0.8], sh: [0, -0.62, 0.78] },
    { pelvis: [0, 0.2, 0], lean: -52, ua: [1, 0.5, 0], fa: [-0.8, 0.5, -0.3], armsInTorso: true, th: [0, 0.6, 0.8], sh: [0, -0.62, 0.78] },
  ],
  anchor: feetAt(0.62), props: [{ shape: "sphere", p: [0, 0.11, -0.12], s: [0.11, 0.11, 0.11], tone: "pad" }, pad([0, 0.005, 0], [0.7, 0.01, 1.8])],
  cam: [2.4, 1.2, 0.8], target: [0, 0.3, 0],
};

const plank: ExerciseMotion = {
  title: "Plank (hold)", cue: "Forearms under the shoulders, body in one straight line from head to heels. Brace and breathe steadily.",
  keys: [
    { pelvis: [0, 0.34, 0], lean: 90, ua: D, fa: [0, 0, 1], th: [0, -0.15, -1], sh: [0, -0.15, -1] },
    { pelvis: [0, 0.345, 0], lean: 90, ua: D, fa: [0, 0, 1], th: [0, -0.16, -1], sh: [0, -0.15, -1] },
  ],
  hold: true, tempo: [2, 0, 2, 0], props: [pad([0, 0.005, 0], [0.7, 0.01, 1.8])], cam: [2.4, 1.1, 0.6], target: [0, 0.3, 0],
};

const abductor: ExerciseMotion = {
  title: "Hip abductor", cue: "Sit tall, pads outside the knees. Press the knees apart, pause, then close slowly without letting the weight touch.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: -12, ua: [0.3, -1, 0.2], fa: [0.1, -0.3, 1], th: [0.08, 0, 1], sh: [0.05, -1, 0.1] },
    { pelvis: [0, 0.55, 0], lean: -12, ua: [0.3, -1, 0.2], fa: [0.1, -0.3, 1], th: [0.65, 0, 0.75], sh: [0.3, -1, 0.1] },
  ],
  props: [seat(0.55), back(0.55, -14, -0.22)], cam: [0.6, 2.2, 2.4],
};

const dbInclinePress: ExerciseMotion = {
  title: "Dumbbell incline press", cue: "Bench at a low incline, shoulder blades set. Press up over the upper chest, then lower with elbows slightly below the bench line.",
  keys: [
    { pelvis: [0, 0.52, 0], lean: -55, ua: [1, -0.4, -0.25], fa: [0, 0.8, 0.55], ...seatedLegs, sh: [0, -1, 0.1] },
    { pelvis: [0, 0.52, 0], lean: -55, ua: [0.18, 0.8, 0.55], fa: [0.05, 0.8, 0.55], ...seatedLegs, sh: [0, -1, 0.1] },
  ],
  hands: "dumbbell", props: [seat(0.52), pad([0, 0.72, -0.28], [0.36, 0.08, 0.7], -55)], cam: [2.4, 1.6, 1.4], target: [0, 0.75, 0],
};

const lowerBackMachine: ExerciseMotion = {
  title: "Lower back extension (machine)", cue: "Pad across the upper back, feet planted. Extend back to upright, pause, then return forward slowly.",
  keys: [
    { pelvis: [0, 0.55, 0], lean: 38, ua: [0, -0.5, 0.7], fa: [-0.7, 0.4, 0.4], armsInTorso: true, ...seatedLegs },
    { pelvis: [0, 0.55, 0], lean: -14, ua: [0, -0.5, 0.7], fa: [-0.7, 0.4, 0.4], armsInTorso: true, ...seatedLegs },
  ],
  props: [seat(0.55), frame([0, 0.08, 0.42], [0.45, 0.04, 0.24])], cam: [2.6, 1.4, 0.8],
};

const benchLegs = { th: [0, -0.35, 0.95] as V, sh: D };
const benchProps = [pad([0, 0.47, -0.5], [0.3, 0.07, 1.25]), frame([0, 0.22, -0.5], [0.08, 0.45, 0.9])];
const flatDbPress: ExerciseMotion = {
  title: "Flat bench dumbbell press", cue: "Lie flat, feet planted, shoulder blades pulled back. Press the dumbbells over the chest, then lower to chest level.",
  keys: [
    { pelvis: [0, 0.6, 0], lean: -90, ua: [1, -0.25, 0], fa: [0, 1, 0.05], ...benchLegs },
    { pelvis: [0, 0.6, 0], lean: -90, ua: [0.12, 1, 0], fa: [0, 1, 0], ...benchLegs },
  ],
  hands: "dumbbell", props: benchProps, cam: [2.2, 1.7, 1.2], target: [0, 0.65, -0.3],
};
const flatBarPress: ExerciseMotion = {
  ...flatDbPress, title: "Flat bench barbell press",
  cue: "Lie flat, eyes under the bar, hands just wider than shoulders. Lower the bar to mid-chest, then press back up over the shoulders.",
  keys: [
    { pelvis: [0, 0.6, 0], lean: -90, ua: [1, -0.25, 0.05], fa: [0.18, 1, 0], ...benchLegs },
    { pelvis: [0, 0.6, 0], lean: -90, ua: [0.4, 1, 0], fa: [0.1, 1, 0], ...benchLegs },
  ],
  hands: "bar", props: [...benchProps, frame([0.5, 0.75, -0.75], [0.05, 0.6, 0.05]), frame([-0.5, 0.75, -0.75], [0.05, 0.6, 0.05])],
};

const lateralRaise: ExerciseMotion = {
  title: "Dumbbell lateral raise", cue: "Stand tall, slight bend in the elbows. Raise the dumbbells out to shoulder height, then lower slowly.",
  keys: [
    { pelvis: [0, 1, 0], lean: 3, ua: [0.15, -1, 0.05], fa: [0.15, -1, 0.1], ...standLegs },
    { pelvis: [0, 1, 0], lean: 3, ua: [1, 0.02, 0.1], fa: [1, -0.02, 0.15], ...standLegs },
  ],
  hands: "dumbbell", anchor: feetAt(0), cam: [0.4, 1.5, 2.8], target: [0, 1, 0],
};

const captainLegRaise: ExerciseMotion = {
  title: "Leg raise (vertical knee-raise station)", cue: "Forearms on the pads, back against the backrest. Lift the legs to hip height without swinging, then lower slowly.",
  keys: [
    { pelvis: [0, 1.05, 0], lean: 0, ua: D, fa: [0, 0, 1], th: [0, -1, 0.05], sh: D },
    { pelvis: [0, 1.05, 0], lean: -4, ua: D, fa: [0, 0, 1], th: [0, -0.02, 1], sh: [0, -0.15, 1] },
  ],
  props: [pad([0, 1.3, -0.12], [0.35, 0.6, 0.07]), pad([0.22, 1.22, 0.12], [0.1, 0.06, 0.32]), pad([-0.22, 1.22, 0.12], [0.1, 0.06, 0.32])],
  cam: [2.6, 1.5, 1.2], target: [0, 1, 0],
};

const russianTwist: ExerciseMotion = {
  title: "Medicine ball Russian twist", cue: "Sit back with a long spine, knees bent. Rotate the ball from one hip to the other, moving through the ribs.",
  keys: [
    { pelvis: [0, 0.13, 0], lean: -42, twist: 38, ua: [-0.2, -0.45, 0.85], fa: [-0.55, 0, 1], armsInTorso: true, th: [0, 0.6, 0.8], sh: [0, -0.62, 0.78] },
    { pelvis: [0, 0.13, 0], lean: -42, twist: -38, ua: [-0.2, -0.45, 0.85], fa: [-0.55, 0, 1], armsInTorso: true, th: [0, 0.6, 0.8], sh: [0, -0.62, 0.78] },
  ],
  hands: "ball", tempo: [1, 0.2, 1, 0.2], props: [pad([0, 0.005, 0], [0.8, 0.01, 1.4])], cam: [0.8, 1.6, 2.4], target: [0, 0.35, 0.1],
};

const standingCurl = (title: string, hands: HandProp, extra: StaticProp[] = []): ExerciseMotion => ({
  title, cue: "Stand tall, elbows by your sides. Curl up without swinging, squeeze, then lower all the way.", hands,
  keys: [
    { pelvis: [0, 1, 0], lean: 2, ua: [0.08, -1, 0.04], fa: [0.08, -1, 0.12], ...standLegs },
    { pelvis: [0, 1, 0], lean: 2, ua: [0.08, -1, 0.1], fa: [0.04, 0.7, 0.7], ...standLegs },
  ],
  anchor: feetAt(0), props: extra, cam: [2.4, 1.5, 1.6], target: [0, 1, 0],
});

const medBallSlam: ExerciseMotion = {
  title: "Medicine ball slam", cue: "Reach the ball overhead, then slam it down in front of the feet, hinging at the hips. Pick it up with a flat back.",
  keys: [
    { pelvis: [0, 1, 0], lean: 52, ua: [0.08, -0.5, 0.85], fa: [-0.1, -0.85, 0.5], th: [0, -0.8, 0.55], sh: [0, -1, 0.3] },
    { pelvis: [0, 1, 0], lean: -6, ua: [0.08, 1, 0.15], fa: [-0.05, 1, 0.2], ...standLegs },
  ],
  hands: "ball", anchor: feetAt(0), tempo: [1, 0.3, 0.5, 0.6], cam: [2.6, 1.5, 1.4], target: [0, 0.9, 0],
};

const abWheel: ExerciseMotion = {
  title: "Ab wheel rollout", cue: "Kneel on the mat, hands on the wheel under the shoulders. Roll forward keeping the ribs down, then pull back with the abs.",
  keys: [
    { pelvis: [0, 0.5, 0], lean: 60, ua: [0, -1, 0.1], fa: [0, -1, 0.1], th: [0, -1, -0.2], sh: [0, 0, -1] },
    { pelvis: [0, 0.5, 0], lean: 85, ua: [0, -0.15, 1], fa: [0, -0.15, 1], th: [0, -0.35, -1], sh: [0, 0, -1] },
  ],
  hands: "wheel", anchor: { joint: "lKnee", at: [0.1, 0.06, 0] }, tempo: [1.8, 0.3, 1.4, 0.4],
  props: [pad([0, 0.005, 0.2], [0.8, 0.01, 1.8])], cam: [2.4, 1.1, 1], target: [0, 0.3, 0.3],
};

/** Keyed by exact exercise name (lowercase, trimmed). Never add a fuzzy match. */
const MOTIONS: Record<string, ExerciseMotion> = {
  "technogym biostrength leg curl": seatedLegCurl,
  "booty builder hack squat machine": hackSquat,
  "technogym biostrength leg extension": legExtension,
  "technogym pure strength hip thrust": hipThrust,
  "technogym selection 700 dual pectoral/reverse fly (reverse fly)": reverseFly,
  "technogym selection 700 dual pectoral/reverse fly (pec fly)": pecFly,
  "technogym selection 700 vertical traction": latPulldown,
  "technogym selection 700 vertical traction (lat pulldown)": latPulldown,
  "technogym selection 900 pulley machine (lat pulldown)": latPulldown,
  "booty builder belt squat machine": beltSquat,
  "technogym selection arm tricep extension": tricepMachine,
  "booty builder loaded back extension": loadedBackExt,
  "technogym selection 900 pulley machine (seated cable row)": seatedRow,
  "dumbbell shoulder press (seated)": dbShoulderPressSeated,
  "pilates ab ball crunches": abBallCrunch,
  "plank": plank,
  "technogym biostrength abductor": abductor,
  "dumbbell incline press": dbInclinePress,
  "technogym selection 700 lower back extension": lowerBackMachine,
  "technogym selection 700 lower back": lowerBackMachine,
  "flat bench dumbbell press": flatDbPress,
  "flat bench chest press (dumbbells)": flatDbPress,
  "flat bench chest press": flatBarPress,
  "flat bench chest press (barbell)": flatBarPress,
  "dumbbell lateral raises": lateralRaise,
  "technogym selection 700 leg raise/dip (leg raises)": captainLegRaise,
  "medicine ball russian twists": russianTwist,
  "technogym cable stations 4 evolution (cable bicep curl)": standingCurl("Cable biceps curl", "bar", [frame([0, 1, 0.75], [0.6, 2, 0.15])]),
  "dumbbell bicep curls": standingCurl("Dumbbell biceps curl", "dumbbell"),
  "curl barbells (bicep curls)": standingCurl("Barbell biceps curl", "bar"),
  "medicine ball slams": medBallSlam,
  "ab wheel rollouts": abWheel,
};

export const exerciseKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
export function getExerciseMotion(name: string | null | undefined): ExerciseMotion | null {
  if (!name) return null;
  return MOTIONS[exerciseKey(name)] ?? null;
}
export const demoExerciseNames = () => Object.keys(MOTIONS);
