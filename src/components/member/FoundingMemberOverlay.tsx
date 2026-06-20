import { useEffect, useMemo } from "react";

interface Props {
  onClose: () => void;
}

/**
 * Bespoke celebration for Founding Member — deep navy + warm gold,
 * intentionally distinct from the class-milestone gold disc.
 * Wordmark-driven, slow shimmer, subtle particle field.
 */
export function FoundingMemberOverlay({ onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
  }, [onClose]);

  const stars = useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      top: rnd(0, 100),
      left: rnd(0, 100),
      size: rnd(1, 3),
      delay: rnd(0, 4),
      dur: rnd(2.4, 5),
      opacity: rnd(0.3, 1),
    }));
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a2540 0%, #0c1426 55%, #050a18 100%)",
      }}
    >
      {/* Slow horizontal aurora */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 30%, rgba(201,168,76,0.08) 50%, transparent 70%)",
          animation: "fm-aurora 9s ease-in-out infinite",
        }}
      />

      {/* Subtle gold vignette glow at top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(201,168,76,0.18) 0%, transparent 55%)",
          animation: "fm-fade-in 1.4s ease-out both",
        }}
      />

      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              background: "#f5e3a8",
              boxShadow: "0 0 6px #c9a84c",
              opacity: s.opacity,
              animation: `fm-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center px-6 max-w-xl">
        {/* Ornamental top rule */}
        <div
          className="flex items-center gap-4 mb-8"
          style={{ animation: "fm-fade-up 900ms 200ms both" }}
        >
          <span className="h-px w-12 bg-[#c9a84c]/60" />
          <span className="text-[10px] tracking-[0.5em] uppercase text-[#c9a84c]">
            Charter Recognition
          </span>
          <span className="h-px w-12 bg-[#c9a84c]/60" />
        </div>

        {/* Crest medallion */}
        <div
          className="relative flex items-center justify-center mb-10"
          style={{
            width: 160,
            height: 160,
            animation: "fm-crest-in 1200ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)",
              filter: "blur(24px)",
              animation: "fm-halo 3.5s ease-in-out infinite",
            }}
          />
          <div
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: 130,
              height: 130,
              background:
                "linear-gradient(145deg, #f5e3a8 0%, #c9a84c 50%, #6b5824 100%)",
              boxShadow:
                "0 0 40px rgba(201,168,76,0.5), inset 0 3px 12px rgba(255,255,255,0.3), inset 0 -6px 16px rgba(0,0,0,0.45)",
            }}
          >
            <div
              className="absolute inset-2 rounded-full border"
              style={{ borderColor: "rgba(255,255,255,0.3)" }}
            />
            <span
              className="font-serif text-[#1a2540]"
              style={{ fontSize: 64, lineHeight: 1, fontStyle: "italic" }}
            >
              S
            </span>
          </div>
        </div>

        <div
          className="text-[11px] tracking-[0.45em] uppercase text-[#c9a84c]"
          style={{ animation: "fm-fade-up 800ms 600ms both" }}
        >
          You Are a
        </div>
        <h1
          className="mt-3 font-serif text-5xl sm:text-6xl text-[#f5f0e0] font-light leading-tight"
          style={{
            animation: "fm-fade-up 900ms 800ms both",
            letterSpacing: "0.04em",
          }}
        >
          Founding Member
        </h1>
        <p
          className="mt-6 max-w-md text-[#c9a84c]/85 italic font-serif text-lg leading-relaxed"
          style={{ animation: "fm-fade-up 900ms 1100ms both" }}
        >
          Here from the beginning.
        </p>

        {/* Ornamental bottom rule */}
        <div
          className="flex items-center gap-4 mt-10"
          style={{ animation: "fm-fade-up 800ms 1500ms both" }}
        >
          <span className="h-px w-8 bg-[#c9a84c]/40" />
          <span className="text-[10px] tracking-[0.4em] uppercase text-[#f5f0e0]/40">
            Tap to continue
          </span>
          <span className="h-px w-8 bg-[#c9a84c]/40" />
        </div>
      </div>

      <style>{`
        @keyframes fm-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fm-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fm-crest-in {
          0%   { transform: scale(0.4) rotate(-12deg); opacity: 0; }
          60%  { transform: scale(1.06) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes fm-halo {
          0%, 100% { opacity: 0.55; transform: scale(0.95); }
          50%      { opacity: 1;    transform: scale(1.1); }
        }
        @keyframes fm-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.7); }
          50%      { opacity: 1;    transform: scale(1.2); }
        }
        @keyframes fm-aurora {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50%      { transform: translateY(-20px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
