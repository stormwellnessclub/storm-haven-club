import { TIERS } from "@/pages/mockup/MilestoneMockup";

interface Props {
  unlocked: Set<number>;
  firstTypes: string[];
}

export function TrophyShelf({ unlocked, firstTypes }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 text-[11px] tracking-[0.3em] uppercase text-[#c9a84c]/80">
          Trophy Shelf
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
          {TIERS.map((t) => {
            const isUnlocked = unlocked.has(t);
            return (
              <div key={t} className="flex flex-col items-center gap-2">
                <div
                  className="relative flex items-center justify-center rounded-full transition-all duration-500"
                  style={{
                    width: 72,
                    height: 72,
                    background: isUnlocked
                      ? "radial-gradient(circle at 30% 30%, #f5e3a8 0%, #c9a84c 50%, #6b5824 100%)"
                      : "transparent",
                    border: isUnlocked ? "none" : "1px solid #3a3328",
                    boxShadow: isUnlocked
                      ? "0 0 24px rgba(201,168,76,0.4), inset 0 2px 6px rgba(255,255,255,0.2)"
                      : "none",
                  }}
                >
                  <span
                    className="font-serif"
                    style={{
                      fontSize: 26,
                      color: isUnlocked ? "#1a1a1a" : "#3a3328",
                    }}
                  >
                    {t}
                  </span>
                </div>
                <span
                  className={`text-[10px] tracking-widest uppercase ${
                    isUnlocked ? "text-[#c9a84c]" : "text-[#3a3328]"
                  }`}
                >
                  {isUnlocked ? "Earned" : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-4 text-[11px] tracking-[0.3em] uppercase text-[#c9a84c]/80">
          First-in-Type Badges
        </div>
        {firstTypes.length === 0 ? (
          <p className="text-sm text-[#f5f0e0]/40 italic">
            Try a new class type to earn your first ⭐
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {firstTypes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#c9a84c]/40 bg-[#c9a84c]/5 text-[#f0d78c] text-xs tracking-wide"
                style={{ animation: "mockup-fade-up 500ms both" }}
              >
                ★ First {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
