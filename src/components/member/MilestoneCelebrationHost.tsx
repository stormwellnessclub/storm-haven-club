import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePendingClassMilestone, useMarkClassMilestonesSeen } from "@/hooks/usePendingClassMilestone";
import { useAuth } from "@/contexts/AuthContext";
import { MilestoneUnlockOverlay } from "./MilestoneUnlockOverlay";

const SEEN_STORAGE_KEY = "swc:milestone-celebrated:v1";

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistSeen(set: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

function markSeenLocal(id: string) {
  const s = loadSeen();
  s.add(id);
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
    if (loadSeen().has(pending.id)) return;

    markSeenLocal(pending.id);
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
