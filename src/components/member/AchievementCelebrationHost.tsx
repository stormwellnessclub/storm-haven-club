import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUncelebratedAchievement,
  useMarkAchievementCelebrated,
  type UncelebratedAchievement,
} from "@/hooks/useUncelebratedAchievement";
import { useAuth } from "@/contexts/AuthContext";
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
const SEEN_STORAGE_KEY = "swc:achievement-celebrated:v1";
const memorySeen = new Set<string>();

type Tier = "founding" | "big" | "small";

function tierFor(a: UncelebratedAchievement): Tier {
  if (a.achievement_type === FOUNDING_TYPE) return "founding";
  if (SMALL_TYPES.has(a.achievement_type)) return "small";
  return "big";
}

function loadSeen(): Set<string> {
  const seen = new Set(memorySeen);
  try {
    [localStorage.getItem(SEEN_STORAGE_KEY), sessionStorage.getItem(SEEN_STORAGE_KEY)].forEach((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach((id) => seen.add(String(id)));
    });
  } catch {
    /* noop */
  }
  return seen;
}

function persistSeen(set: Set<string>) {
  try {
    const payload = JSON.stringify(Array.from(set));
    localStorage.setItem(SEEN_STORAGE_KEY, payload);
    sessionStorage.setItem(SEEN_STORAGE_KEY, payload);
  } catch {
    /* noop */
  }
}

function seenKeys(a: UncelebratedAchievement, userId?: string | null) {
  return [
    `id:${a.id}`,
    `type:${a.achievement_type}`,
    userId ? `user:${userId}:type:${a.achievement_type}` : null,
  ].filter(Boolean) as string[];
}

function markSeenLocal(keys: string[]) {
  const s = loadSeen();
  keys.forEach((key) => {
    memorySeen.add(key);
    s.add(key);
  });
  persistSeen(s);
}

export function AchievementCelebrationHost() {
  const { data: pending } = useUncelebratedAchievement();
  const markSeen = useMarkAchievementCelebrated();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shown, setShown] = useState<UncelebratedAchievement | null>(null);

  useEffect(() => {
    if (!pending) return;
    if (shown) return;
    const keys = seenKeys(pending, user?.id);
    const seen = loadSeen();
    if (keys.some((key) => seen.has(key))) return;

    const tier = tierFor(pending);

    // Mark seen locally + clear cache immediately so a refetch can't resurrect it
    markSeenLocal(keys);
    qc.setQueryData(["uncelebrated-achievement", user?.id], null);

    if (tier === "small") {
      toast.success(pending.achievement_name, {
        description: pending.description ?? "Achievement unlocked",
        duration: 5000,
        icon: <Sparkles className="h-4 w-4 text-[#c9a84c]" />,
        className: "border-[#c9a84c]/40",
      });
      markSeen.mutate({ achievementId: pending.id, achievementType: pending.achievement_type });
    } else {
      setShown(pending);
      // Fire DB write right away — don't wait for dismiss
      markSeen.mutate({ achievementId: pending.id, achievementType: pending.achievement_type });
    }
  }, [pending, shown, markSeen, qc, user?.id]);

  if (!shown) return null;

  const handleClose = () => {
    setShown(null);
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
