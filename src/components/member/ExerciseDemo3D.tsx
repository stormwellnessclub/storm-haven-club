import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeJoints, lerpPose, motionPhase, type ExerciseMotion, type Joints, type V } from "@/lib/exerciseMotions";

function token(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const [h, s, l] = v.split(/\s+/);
  return `hsl(${h}, ${s}, ${l})`;
}

const BONES: [keyof Joints, keyof Joints, number][] = [
  ["pelvis", "neck", 0.085], ["lShoulder", "rShoulder", 0.06], ["lHip", "rHip", 0.07],
  ["lShoulder", "lElbow", 0.045], ["lElbow", "lHand", 0.038], ["rShoulder", "rElbow", 0.045], ["rElbow", "rHand", 0.038],
  ["lHip", "lKnee", 0.06], ["lKnee", "lAnkle", 0.047], ["lAnkle", "lToe", 0.032],
  ["rHip", "rKnee", 0.06], ["rKnee", "rAnkle", 0.047], ["rAnkle", "rToe", 0.032],
];

const up = new THREE.Vector3(0, 1, 0);
function placeBone(m: THREE.Object3D, a: V, b: V) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(up, dir.normalize());
  m.scale.set(1, Math.max(0.001, len), 1);
}

function Figure({ motion, playing, colors }: { motion: ExerciseMotion; playing: boolean; colors: Record<string, string> }) {
  const bones = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Mesh>(null);
  const joints = useRef<(THREE.Mesh | null)[]>([]);
  const lHand = useRef<THREE.Group>(null), rHand = useRef<THREE.Group>(null), mid = useRef<THREE.Group>(null);
  const lAnk = useRef<THREE.Group>(null), rAnk = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const jointKeys: (keyof Joints)[] = ["lShoulder", "rShoulder", "lElbow", "rElbow", "lKnee", "rKnee", "lHip", "rHip", "lHand", "rHand"];

  useFrame((_, delta) => {
    if (playing) clock.current += Math.min(delta, 0.05);
    const pose = lerpPose(motion.keys[0], motion.keys[1], motionPhase(motion, clock.current));
    const j = computeJoints(pose, motion.anchor);
    BONES.forEach(([a, b], i) => { const m = bones.current[i]; if (m) placeBone(m, j[a], j[b]); });
    if (head.current) head.current.position.set(...j.head);
    jointKeys.forEach((k, i) => joints.current[i]?.position.set(...j[k]));
    const hands = (g: THREE.Group | null, p: V) => g?.position.set(...p);
    hands(lHand.current, j.lHand); hands(rHand.current, j.rHand);
    if (mid.current) {
      mid.current.position.set((j.lHand[0] + j.rHand[0]) / 2, (j.lHand[1] + j.rHand[1]) / 2, (j.lHand[2] + j.rHand[2]) / 2);
    }
    hands(lAnk.current, j.lAnkle); hands(rAnk.current, j.rAnkle);
  });

  const skin = <meshStandardMaterial color={colors.body} roughness={0.55} metalness={0.05} />;
  const metal = <meshStandardMaterial color={colors.metal} roughness={0.35} metalness={0.6} />;
  const pair = motion.hands === "dumbbell" || motion.hands === "handle";
  const single = motion.hands && !pair && motion.hands !== "none";

  return (
    <group>
      {BONES.map((_, i) => (
        <mesh key={i} ref={(m) => (bones.current[i] = m)} castShadow>
          <cylinderGeometry args={[BONES[i][2], BONES[i][2], 1, 14]} />
          {skin}
        </mesh>
      ))}
      {jointKeys.map((k, i) => (
        <mesh key={k} ref={(m) => (joints.current[i] = m)} castShadow>
          <sphereGeometry args={[k.includes("Hip") ? 0.065 : k.includes("Hand") ? 0.04 : 0.05, 16, 12]} />
          {skin}
        </mesh>
      ))}
      <mesh ref={head} castShadow><sphereGeometry args={[0.105, 24, 18]} />{skin}</mesh>

      {pair && [lHand, rHand].map((r, i) => (
        <group key={i} ref={r}>
          {motion.hands === "dumbbell" ? (
            <>
              <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />{metal}</mesh>
              {[-0.09, 0.09].map((x) => (
                <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.05, 16]} />{metal}</mesh>
              ))}
            </>
          ) : (
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.13, 10]} />{metal}</mesh>
          )}
        </group>
      ))}
      {single && (
        <group ref={mid}>
          {motion.hands === "bar" && <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.014, 0.014, 1.1, 10]} />{metal}</mesh>}
          {motion.hands === "vhandle" && <mesh><boxGeometry args={[0.16, 0.04, 0.06]} />{metal}</mesh>}
          {motion.hands === "ball" && <mesh><sphereGeometry args={[0.12, 24, 18]} /><meshStandardMaterial color={colors.accent} roughness={0.8} /></mesh>}
          {motion.hands === "plate" && <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.03, 24]} />{metal}</mesh>}
          {motion.hands === "wheel" && <mesh position={[0, -0.06, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.08, 24]} /><meshStandardMaterial color={colors.accent} roughness={0.6} /></mesh>}
        </group>
      )}
      {motion.ankles === "roller" && [lAnk, rAnk].map((r, i) => (
        <group key={i} ref={r}>
          <mesh position={[0, 0, 0.07]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.16, 16]} /><meshStandardMaterial color={colors.pad} roughness={0.7} /></mesh>
        </group>
      ))}
    </group>
  );
}

export default function ExerciseDemo3D({ motion, className }: { motion: ExerciseMotion; className?: string }) {
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const colors = useMemo(() => ({
    body: token("--muted-foreground", "#b9b3aa"),
    metal: token("--foreground", "#333"),
    pad: token("--primary", "#8a7356"),
    accent: token("--accent", "#8a7356"),
    floor: token("--muted", "#eee"),
    frame: token("--border", "#ccc"),
  }), []);
  useEffect(() => { const t = setTimeout(() => setReady(true), 50); return () => clearTimeout(t); }, []);
  const target = motion.target ?? [0, 0.75, 0];

  return (
    <div className={className ?? "relative h-64 w-full rounded-lg overflow-hidden bg-muted"} data-scene-ready={ready ? "true" : undefined}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: motion.cam ?? [2.3, 1.5, 2.2], fov: 38 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[2.6, 48]} />
          <meshStandardMaterial color={colors.floor} roughness={0.9} />
        </mesh>
        {(motion.props ?? []).map((p, i) => (
          <mesh key={i} position={p.p} rotation={[((p.rx ?? 0) * Math.PI) / 180, 0, 0]} castShadow receiveShadow>
            {p.shape === "sphere" ? <sphereGeometry args={[p.s[0], 24, 18]} /> : <boxGeometry args={p.s} />}
            <meshStandardMaterial color={p.tone === "frame" ? colors.frame : colors.pad} roughness={p.tone === "frame" ? 0.4 : 0.75} metalness={p.tone === "frame" ? 0.4 : 0} />
          </mesh>
        ))}
        <Figure motion={motion} playing={playing} colors={colors} />
        <OrbitControls target={target} enablePan={false} minDistance={1.6} maxDistance={5} maxPolarAngle={Math.PI / 2 - 0.05} />
      </Canvas>
      <Button size="sm" variant="secondary" className="absolute bottom-2 right-2 h-9" onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause demo" : "Play demo"}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <p className="absolute bottom-2 left-3 text-[11px] text-muted-foreground">Drag to turn</p>
    </div>
  );
}
