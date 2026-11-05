import ExerciseDemo3D from "@/components/member/ExerciseDemo3D";
import { getExerciseMotion } from "@/lib/exerciseMotions";
export default function DemoCheck() {
  const n = new URLSearchParams(location.search).get("n") || "";
  const m = getExerciseMotion(n);
  return m ? <div style={{ width: 600 }}><ExerciseDemo3D motion={m} className="relative h-[450px] w-full bg-muted" /></div> : <p>none</p>;
}
