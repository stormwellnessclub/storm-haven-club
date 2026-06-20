import { useMemo, useState } from "react";
import { MilestoneRing } from "@/components/mockup/MilestoneRing";
import { MilestoneUnlockOverlay } from "@/components/mockup/MilestoneUnlockOverlay";
import { TrophyShelf } from "@/components/mockup/TrophyShelf";
import { FirstTypeToast } from "@/components/mockup/FirstTypeToast";

export const TIERS = [1, 5, 10, 25, 50, 100, 200, 500];
const CLASS_TYPES = ["Reformer Pilates", "Cycling", "Aerobics", "Yoga", "Barre"];

export default function MilestoneMockup() {
  const [count, setCount] = useState(3);
  const [unlocked, setUnlocked] = useState<Set<number>>(new Set([1]));
  const [overlayTier, setOverlayTier] = useState<number | null>(null);
  const [firstTypes, setFirstTypes] = useState<string[]>([]);
  const [toastType, setToastType] = useState<string | null>(null);

  const { nextTier, prevTier } = useMemo(() => {
    const next = TIERS.find((t) => t > count) ?? TIERS[TIERS.length - 1];
    const prevCandidates = TIERS.filter((t) => t <= count);
    const prev = prevCandidates.length ? prevCandidates[prevCandidates.length - 1] : 0;
    return { nextTier: next, prevTier: prev };
  }, [count]);

  const away = Math.max(0, nextTier - count);

  const completeClass = () => {
    const newCount = count + 1;
    setCount(newCount);
    if (TIERS.includes(newCount) && !unlocked.has(newCount)) {
      setUnlocked((prev) => new Set(prev).add(newCount));
      setTimeout(() => setOverlayTier(newCount), 400);
    }
  };

  const jumpToNext = () => {
    if (count >= nextTier) return;
    setCount(nextTier);
    if (!unlocked.has(nextTier)) {
      setUnlocked((prev) => new Set(prev).add(nextTier));
      setTimeout(() => setOverlayTier(nextTier), 400);
    }
  };

  const reset = () => {
    setCount(0);
    setUnlocked(new Set());
    setFirstTypes([]);
  };

  const triggerFirstType = () => {
    const available = CLASS_TYPES.filter((c) => !firstTypes.includes(c));
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    setFirstTypes((prev) => [...prev, pick]);
    setToastType(pick);
  };

  return (
    <div
      className="min-h-screen text-[#f5f0e0]"
      style={{ background: "linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%)" }}
    >
      <div className="max-w-4xl mx-auto px-6 py-16 sm:py-24 space-y-20">
        {/* Header */}
        <div className="text-center">
          <div className="text-[11px] tracking-[0.4em] uppercase text-[#c9a84c] mb-3">
            Engagement Mockup · Interactive Preview
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-light">
            Your Practice
          </h1>
        </div>

        {/* Hero Ring */}
        <section className="flex flex-col items-center">
          <MilestoneRing current={count} nextTier={nextTier} prevTier={prevTier} />
          <p className="mt-8 font-serif text-xl text-[#f5f0e0]/80 italic">
            {away === 0
              ? "You've reached the summit."
              : `${away} ${away === 1 ? "class" : "classes"} from your next milestone`}
          </p>
          <p className="text-sm text-[#f5f0e0]/40 mt-2 tracking-wide">
            Next: {nextTier} classes
          </p>
        </section>

        {/* Controls */}
        <section className="border-t border-b border-[#c9a84c]/20 py-10">
          <div className="text-[11px] tracking-[0.3em] uppercase text-[#c9a84c]/80 mb-6 text-center">
            Simulator
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <button
              onClick={completeClass}
              className="px-8 py-4 rounded-md font-medium tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #c9a84c, #f0d78c)",
                color: "#1a1a1a",
                boxShadow: "0 8px 24px rgba(201,168,76,0.3)",
              }}
            >
              Complete a class →
            </button>
            <button
              onClick={jumpToNext}
              className="px-6 py-4 rounded-md border border-[#c9a84c]/40 text-[#f0d78c] hover:bg-[#c9a84c]/10 transition-colors"
            >
              Jump to next milestone
            </button>
            <button
              onClick={triggerFirstType}
              className="px-6 py-4 rounded-md border border-[#c9a84c]/40 text-[#f0d78c] hover:bg-[#c9a84c]/10 transition-colors"
            >
              ★ First-in-type badge
            </button>
            <button
              onClick={reset}
              className="px-6 py-4 rounded-md border border-[#3a3328] text-[#f5f0e0]/50 hover:text-[#f5f0e0] transition-colors"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Trophy Shelf */}
        <section>
          <TrophyShelf unlocked={unlocked} firstTypes={firstTypes} />
        </section>

        {/* Psychology notes */}
        <section className="pt-8 border-t border-[#c9a84c]/10">
          <div className="text-[11px] tracking-[0.3em] uppercase text-[#c9a84c]/60 mb-4">
            Why this works
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm text-[#f5f0e0]/60 leading-relaxed">
            <p><span className="text-[#c9a84c]">Anticipation.</span> The ring fills before the reward — dopamine peaks in the chase, not the catch.</p>
            <p><span className="text-[#c9a84c]">Peak moment.</span> The unlock is brief, earned, cinematic — designed to be remembered.</p>
            <p><span className="text-[#c9a84c]">Endowment.</span> Locked badges are visible. You can see what's yours and what could be.</p>
            <p><span className="text-[#c9a84c]">Variable reward.</span> First-in-type ⭐ badges arrive unpredictably, keeping novelty alive.</p>
          </div>
        </section>
      </div>

      <MilestoneUnlockOverlay
        milestone={overlayTier}
        onClose={() => setOverlayTier(null)}
      />
      <FirstTypeToast className={toastType} onClose={() => setToastType(null)} />
    </div>
  );
}
