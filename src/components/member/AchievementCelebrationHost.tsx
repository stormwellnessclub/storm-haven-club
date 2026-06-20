import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import {
  useUncelebratedAchievement,
  useMarkAchievementCelebrated,
  type UncelebratedAchievement,
} from "@/hooks/useUncelebratedAchievement";
import { AchievementOverlayBig } from "./AchievementOverlayBig";
import { FoundingMemberOverlay } from "./FoundingMemberOverlay";

// Small toast tier — quick wins
const SMALL_TYPES = new Set([
  "first_check_in",
  "early_bird",
  "night_owl",
  "social_butterfly",
]);

const FOUNDING_TYPE = "founding_member";

type Tier = "founding" | "big" | "small";

function tierFor(a: UncelebratedAchievement): Tier {
  if (a.achievement_type === FOUNDING_TYPE) return "founding";
  if (SMALL_TYPES.has(a.achievement_type)) return "small";
  return "big";
}

/**
 * Mounts the right celebration UI for the signed-in user's most recent
 * uncelebrated achievement. Founding Member gets a unique navy/gold overlay,
 * big achievements reuse the Celestial Gold treatment, small ones surface
 * as a sonner toast.
 */
export function AchievementCelebrationHost() {
  const { data: pending } = useUncelebratedAchievement();
  const markSeen = useMarkAchievementCelebrated();
  const [shown, setShown] = useState<UncelebratedAchievement | null>(null);
  const [seenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!pending) return;
    if (seenIds.has(pending.id)) return;
    if (shown) return;

    const tier = tierFor(pending);

    if (tier === "small") {
      // Fire & forget toast — mark seen immediately so it doesn't loop
      seenIds.add(pending.id);
      toast.success(pending.achievement_name, {
        description: pending.description ?? "Achievement unlocked",
        duration: 5000,
        icon: <Sparkles className="h-4 w-4 text-[#c9a84c]" />,
        className: "border-[#c9a84c]/40",
      });
      markSeen.mutate(pending.id);
    } else {
      setShown(pending);
      seenIds.add(pending.id);
    }
  }, [pending, shown, seenIds, markSeen]);

  if (!shown) return null;

  const handleClose = () => {
    const id = shown.id;
    setShown(null);
    markSeen.mutate(id);
  };

  const tier = tierFor(shown);

  if (tier === "founding") {
    return <FoundingMemberOverlay onClose={handleClose} />;
  }

  return (
    <AchievementOverlayBig
      name={shown.achievement_name}
      description={shown.description}
      onClose={handleClose}
    />
  );
}
