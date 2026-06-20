import { useEffect, useMemo } from "react";

interface Props {
  name: string;
  description: string | null;
  onClose: () => void;
}

type Bokeh = { id: number; top: number; left: number; size: number; opacity: number; blur: number; delay: number };
type Flake = { id: number; top: number; left: number; w: number; h: number; rot: number; opacity: number; dur: number; delay: number };
type Fleck = { id: number; top: number; left: number; size: number; color: string; delay: number };

/**
 * Celestial Gold overlay for "big" achievements (Century Club, Week Warrior, etc).
 * Mirrors MilestoneUnlockOverlay's treatment but renders the achievement name
 * and a single initial inside the gold disc instead of a class count.
 */
export function AchievementOverlayBig({ name, description, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4800);
    return () => clearTimeout(t);
  }, [onClose]);

  const initial = (name?.trim()?.[0] || "★").toUpperCase();

  const { bokeh, flakes, flecks, fallers } = useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const bokeh: Bokeh[] = Array.from({ length: 10 }, (_, i) => ({
      id: i, top: rnd(5, 95), left: rnd(5, 95), size: rnd(8, 22),
      opacity: rnd(0.15, 0.4), blur: rnd(2, 6), delay: rnd(0, 2),
    }));
    const flakes: Flake[] = Array.from({ length: 18 }, (_, i) => ({
      id: i, top: rnd(0, 100), left: rnd(0, 100), w: rnd(2, 4), h: rnd(6, 14),
      rot: rnd(-60, 120), opacity: rnd(0.35, 0.7), dur: rnd(3, 5.5), delay: rnd(0, 2),
    }));
    const flecks: Fleck[] = Array.from({ length: 28 }, (_, i) => ({
      id: i, top: rnd(0, 100), left: rnd(0, 100), size: rnd(1.5, 3),
      color: Math.random() > 0.5 ? "#f0d78c" : "#ffffff", delay: rnd(0, 2.5),
    }));
    const fallers = Array.from({ length: 60 }, (_, i) => ({
      id: i, left: rnd(0, 100), delay: rnd(0, 0.8),
      duration: rnd(2.2, 3.8), size: rnd(2, 6), drift: rnd(-40, 40),
    }));
    return { bokeh, flakes, flecks, fallers };
  }, [name]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md cursor-pointer overflow-hidden"
      style={{ background: "radial-gradient(circle at center, rgba(26,26,26,0.92), rgba(13,13,13,0.98))" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at center, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0.05) 35%, transparent 65%)",
        filter: "blur(20px)", animation: "ach-aura 3.5s ease-out forwards",
      }} />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[140vmin] h-[140vmin] opacity-0" style={{
          background: "conic-gradient(from 0deg, transparent 0deg, rgba(201,168,76,0.18) 12deg, transparent 28deg, transparent 70deg, rgba(240,215,140,0.14) 84deg, transparent 100deg, transparent 170deg, rgba(201,168,76,0.16) 184deg, transparent 200deg, transparent 260deg, rgba(240,215,140,0.12) 274deg, transparent 290deg)",
          filter: "blur(18px)", animation: "ach-rays-in 1.2s ease-out forwards, ach-spin 30s linear 0.2s infinite",
        }} />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {bokeh.map((b) => (
          <span key={`b-${b.id}`} className="absolute rounded-full" style={{
            top: `${b.top}%`, left: `${b.left}%`, width: b.size, height: b.size,
            background: "radial-gradient(circle, #f0d78c 0%, rgba(201,168,76,0) 70%)",
            opacity: b.opacity, filter: `blur(${b.blur}px)`,
            animation: `ach-bokeh 3.5s ease-in-out ${b.delay}s infinite`,
          }} />
        ))}
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {flakes.map((f) => (
          <span key={`fl-${f.id}`} className="absolute" style={{
            top: `${f.top}%`, left: `${f.left}%`, width: f.w, height: f.h,
            background: "linear-gradient(180deg, #f0d78c, rgba(201,168,76,0))",
            transform: `rotate(${f.rot}deg)`, opacity: f.opacity,
            animation: `ach-float ${f.dur}s ease-in-out ${f.delay}s infinite`,
          }} />
        ))}
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {flecks.map((f) => (
          <span key={`sh-${f.id}`} className="absolute rounded-full" style={{
            top: `${f.top}%`, left: `${f.left}%`, width: f.size, height: f.size,
            background: f.color, boxShadow: `0 0 6px ${f.color === "#ffffff" ? "#f0d78c" : "#c9a84c"}`,
            animation: `ach-shimmer 2.4s ease-in-out ${f.delay}s infinite`, opacity: 0,
          }} />
        ))}
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {fallers.map((p) => (
          <span key={`fa-${p.id}`} className="absolute top-0 rounded-full" style={{
            left: `${p.left}%`, width: p.size, height: p.size,
            background: "linear-gradient(180deg, #f0d78c, #c9a84c)",
            boxShadow: "0 0 10px #c9a84c",
            animation: `ach-fall ${p.duration}s ${p.delay}s cubic-bezier(0.22,1,0.36,1) forwards`,
            opacity: 0, ["--drift" as any]: `${p.drift}px`,
          }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center px-6">
        <div className="absolute rounded-full pointer-events-none" style={{
          width: 320, height: 320, top: -50,
          background: "radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)",
          filter: "blur(30px)", animation: "ach-halo 2.4s ease-in-out infinite",
        }} />

        <div className="relative flex items-center justify-center rounded-full" style={{
          width: 220, height: 220,
          background: "radial-gradient(circle at 30% 30%, #f5e3a8 0%, #c9a84c 45%, #6b5824 100%)",
          boxShadow: "0 0 50px rgba(201,168,76,0.6), 0 0 120px rgba(201,168,76,0.25), inset 0 4px 16px rgba(255,255,255,0.25), inset 0 -8px 20px rgba(0,0,0,0.4)",
          animation: "ach-badge-in 900ms cubic-bezier(0.22,1,0.36,1) forwards",
        }}>
          <div className="absolute inset-3 rounded-full border" style={{ borderColor: "rgba(255,255,255,0.25)" }} />
          <span className="font-serif text-[#1a1a1a]" style={{ fontSize: 110, lineHeight: 1 }}>
            {initial}
          </span>
        </div>

        <div className="mt-10 text-[11px] tracking-[0.4em] uppercase text-[#c9a84c]"
          style={{ animation: "ach-fade-up 700ms 400ms both" }}>
          You Showed Up
        </div>
        <h2 className="mt-3 font-serif text-4xl sm:text-5xl text-[#f5f0e0] font-light"
          style={{ animation: "ach-fade-up 700ms 550ms both", letterSpacing: "0.02em" }}>
          {name}
        </h2>
        {description && (
          <p className="mt-4 max-w-md text-[#c9a84c]/80 italic font-serif text-lg"
            style={{ animation: "ach-fade-up 700ms 700ms both" }}>
            {description}
          </p>
        )}

        <div className="mt-10 text-xs text-[#f5f0e0]/40 tracking-[0.25em] uppercase"
          style={{ animation: "ach-fade-up 700ms 1100ms both" }}>
          Tap anywhere to continue
        </div>
      </div>

      <style>{`
        @keyframes ach-badge-in { 0%{transform:scale(0.2) rotate(-30deg);opacity:0;} 60%{transform:scale(1.08) rotate(4deg);opacity:1;} 100%{transform:scale(1) rotate(0);opacity:1;} }
        @keyframes ach-fade-up { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
        @keyframes ach-fall { 0%{transform:translate3d(0,-20px,0);opacity:0;} 10%{opacity:1;} 100%{transform:translate3d(var(--drift,0),110vh,0);opacity:0;} }
        @keyframes ach-aura { from{opacity:0;transform:scale(0.6);} to{opacity:1;transform:scale(1);} }
        @keyframes ach-rays-in { from{opacity:0;} to{opacity:0.35;} }
        @keyframes ach-spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        @keyframes ach-bokeh { 0%,100%{transform:scale(0.85);opacity:0.2;} 50%{transform:scale(1.15);opacity:0.55;} }
        @keyframes ach-float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-14px);} }
        @keyframes ach-shimmer { 0%,100%{opacity:0;transform:scale(0.6);} 50%{opacity:1;transform:scale(1.2);} }
        @keyframes ach-halo { 0%,100%{opacity:0.6;transform:scale(0.95);} 50%{opacity:1;transform:scale(1.08);} }
      `}</style>
    </div>
  );
}
