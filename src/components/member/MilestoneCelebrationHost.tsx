import { useEffect, useState } from "react";
import { usePendingClassMilestone, useMarkClassMilestonesSeen } from "@/hooks/usePendingClassMilestone";
import { MilestoneUnlockOverlay } from "./MilestoneUnlockOverlay";

/**
 * Mounts the Celestial Gold celebration overlay whenever the signed-in
 * member has an unseen class milestone. Drops itself in at the layout level
 * so it can fire on any page once they enter the portal.
 */
export function MilestoneCelebrationHost() {
  const { data: pending } = usePendingClassMilestone();
  const markSeen = useMarkClassMilestonesSeen();
  const [shown, setShown] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pending?.milestone && !dismissed && shown == null) {
      setShown(pending.milestone);
    }
  }, [pending?.milestone, dismissed, shown]);

  if (shown == null) return null;

  const handleClose = () => {
    setDismissed(true);
    setShown(null);
    markSeen.mutate();
  };

  return <MilestoneUnlockOverlay milestone={shown} onClose={handleClose} />;
}
