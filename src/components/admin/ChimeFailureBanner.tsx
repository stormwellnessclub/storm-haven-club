import { useSyncExternalStore } from "react";
import { AlertTriangle, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearPendingChimeAlerts,
  getChimeEngineSnapshot,
  subscribeChimeEngine,
  unlockChimeAudio,
  playNotificationChime,
} from "./AdminSupportChime";

export function ChimeFailureBanner() {
  const snapshot = useSyncExternalStore(subscribeChimeEngine, getChimeEngineSnapshot, getChimeEngineSnapshot);
  if (snapshot.pendingAlerts === 0) return null;

  const restore = async () => {
    await unlockChimeAudio();
    await playNotificationChime();
    // Always clear: the banner is an alert notice, not a permanent audio-state indicator.
    clearPendingChimeAlerts();
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] border-b border-destructive bg-destructive text-destructive-foreground shadow-elevated" role="alert">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
        <p className="flex-1 text-sm font-semibold">
          {snapshot.pendingAlerts} alert{snapshot.pendingAlerts === 1 ? "" : "s"} arrived while sound was blocked.
        </p>
        <Button size="sm" variant="secondary" className="gap-2" onClick={restore}>
          <Volume2 className="h-4 w-4" />
          Restore sound
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss alert notice"
          className="h-8 w-8 shrink-0 hover:bg-destructive-foreground/20"
          onClick={() => clearPendingChimeAlerts()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
