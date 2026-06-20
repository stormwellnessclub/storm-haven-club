import { useEffect, useMemo } from "react";

interface Props {
  milestone: number | null;
  onClose: () => void;
}

const COPY: Record<number, string> = {
  1: "The first step is the hardest.",
  5: "A rhythm is forming.",
  10: "Consistency is becoming you.",
  25: "Devotion, measured in showings.",
  50: "Few make it this far.",
  100: "A practitioner.",
  200: "Rare air.",
  500: "Legendary.",
};

export function MilestoneUnlockOverlay({ milestone, onClose }: Props) {
  useEffect(() => {
    if (milestone == null) return;
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [milestone, onClose]);

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.2,
        size: 2 + Math.random() * 4,
      })),
    [milestone]
  );

  if (milestone == null) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md cursor-pointer"
      style={{ background: "radial-gradient(circle at center, rgba(26,26,26,0.92), rgba(13,13,13,0.98))" }}
    >
      {/* Gold particles falling */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 rounded-full"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: "linear-gradient(180deg, #f0d78c, #c9a84c)",
              boxShadow: "0 0 8px #c9a84c",
              animation: `mockup-fall ${p.duration}s ${p.delay}s cubic-bezier(0.22,1,0.36,1) forwards`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center px-6">
        {/* Badge disc */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 220,
            height: 220,
            background:
              "radial-gradient(circle at 30% 30%, #f5e3a8 0%, #c9a84c 45%, #6b5824 100%)",
            boxShadow: "0 0 80px rgba(201,168,76,0.55), inset 0 4px 16px rgba(255,255,255,0.25), inset 0 -8px 20px rgba(0,0,0,0.4)",
            animation: "mockup-badge-in 900ms cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          <div
            className="absolute inset-3 rounded-full border"
            style={{ borderColor: "rgba(255,255,255,0.25)" }}
          />
          <span className="font-serif text-[#1a1a1a]" style={{ fontSize: 88, lineHeight: 1 }}>
            {milestone}
          </span>
        </div>

        <div
          className="mt-10 text-[11px] tracking-[0.4em] uppercase text-[#c9a84c]"
          style={{ animation: "mockup-fade-up 700ms 400ms both" }}
        >
          Milestone Unlocked
        </div>
        <h2
          className="mt-3 font-serif text-5xl sm:text-6xl text-[#f5f0e0] font-light"
          style={{ animation: "mockup-fade-up 700ms 550ms both" }}
        >
          {milestone} {milestone === 1 ? "Class" : "Classes"}
        </h2>
        <p
          className="mt-4 max-w-md text-[#c9a84c]/80 italic font-serif text-lg"
          style={{ animation: "mockup-fade-up 700ms 700ms both" }}
        >
          {COPY[milestone] ?? "Earned."}
        </p>

        <div
          className="mt-10 text-xs text-[#f5f0e0]/40 tracking-widest uppercase"
          style={{ animation: "mockup-fade-up 700ms 1100ms both" }}
        >
          Tap anywhere to continue
        </div>
      </div>

      <style>{`
        @keyframes mockup-badge-in {
          0%   { transform: scale(0.2) rotate(-30deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes mockup-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mockup-fall {
          0%   { transform: translateY(-20px); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
