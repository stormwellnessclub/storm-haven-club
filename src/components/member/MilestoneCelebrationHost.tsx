import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePendingClassMilestone, useMarkClassMilestonesSeen } from "@/hooks/usePendingClassMilestone";
import { useAuth } from "@/contexts/AuthContext";
import { MilestoneUnlockOverlay } from "./MilestoneUnlockOverlay";

const SEEN_STORAGE_KEY = "swc:milestone-celebrated:v1";
const memorySeen = new Set<string>();

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

function markSeenLocal(id: string) {
  // Only dedupe by row id within the same browser session. DB `celebrated_at`
  // is the cross-session source of truth.
  const s = loadSeen();
  const key = `id:${id}`;
  memorySeen.add(key);
  s.add(key);
  persistSeen(s);
}

export function MilestoneCelebrationHost() {
  const { data: pending } = usePendingClassMilestone();
  const markSeen = useMarkClassMilestonesSeen();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!pending?.milestone || !pending.id) return;
    if (shown != null) return;
    const seen = loadSeen();
    if (
      seen.has(`id:${pending.id}`) ||
      seen.has(`user:${user?.id}:milestone:${pending.milestone}`)
    ) return;

    markSeenLocal(pending.id, user?.id, pending.milestone);
    qc.setQueryData(["pending-class-milestone", user?.id], null);
    setShown(pending.milestone);
    markSeen.mutate();
  }, [pending?.id, pending?.milestone, shown, markSeen, qc, user?.id]);

  if (shown == null) return null;

  const handleClose = () => {
    setShown(null);
  };

  return <MilestoneUnlockOverlay milestone={shown} onClose={handleClose} />;
}
