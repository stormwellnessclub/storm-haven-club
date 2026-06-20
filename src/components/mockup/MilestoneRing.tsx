import { useEffect, useState } from "react";

interface Props {
  current: number;
  nextTier: number;
  prevTier: number;
  size?: number;
}

export function MilestoneRing({ current, nextTier, prevTier, size = 320 }: Props) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const span = Math.max(1, nextTier - prevTier);
  const progressed = Math.min(span, Math.max(0, current - prevTier));
  const pct = progressed / span;
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const offset = circ * (1 - animPct);
  const glow = pct > 0.85 ? "drop-shadow(0 0 24px #c9a84c)" : "drop-shadow(0 0 10px rgba(201,168,76,0.35))";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3a3328"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#goldGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1100ms cubic-bezier(0.22, 1, 0.36, 1)",
            filter: glow,
          }}
        />
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9a84c" />
            <stop offset="100%" stopColor="#f0d78c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="font-serif font-light leading-none text-[#f5f0e0]"
          style={{ fontSize: size * 0.32 }}
        >
          {current}
        </div>
        <div className="mt-3 text-[11px] tracking-[0.3em] uppercase text-[#c9a84c]/80">
          Classes Completed
        </div>
      </div>
    </div>
  );
}
