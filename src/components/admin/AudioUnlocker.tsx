import { useEffect } from "react";
import { isAudioBlocked, markChimeAudioNeedsUnlock, unlockChimeAudio } from "./AdminSupportChime";

/**
 * Browsers block audio until the user has interacted with the page, and they
 * also SUSPEND the audio engine again when a tab is backgrounded for a while —
 * which is exactly what happens on a front-desk station that sits idle.
 *
 * So instead of unlocking once, we keep listening and re-wake the SHARED audio
 * engine on any interaction (or tab focus) whenever it's blocked again.
 */
export function AudioUnlocker() {
  useEffect(() => {
    let silentPlayed = false;

    const unlock = () => {
      if (!isAudioBlocked()) return;

      // 1) Wake the shared WebAudio context used by playNotificationChime()
      void unlockChimeAudio();

      // 2) Play a silent <audio> element once (covers HTMLAudio fallback path)
      if (!silentPlayed) {
        silentPlayed = true;
        try {
          const silent =
            "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
          const a = new Audio(silent);
          a.volume = 0;
          a.play().catch(() => {});
        } catch (e) {
          console.warn("AudioUnlocker failed:", e);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") unlock();
      else markChimeAudioNeedsUnlock();
    };
    const onFreeze = () => markChimeAudioNeedsUnlock();

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    window.addEventListener("focus", unlock);
    window.addEventListener("online", unlock);
    window.addEventListener("pageshow", unlock);
    document.addEventListener("resume", unlock);
    document.addEventListener("freeze", onFreeze);
    window.addEventListener("pagehide", onFreeze);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("focus", unlock);
      window.removeEventListener("online", unlock);
      window.removeEventListener("pageshow", unlock);
      document.removeEventListener("resume", unlock);
      document.removeEventListener("freeze", onFreeze);
      window.removeEventListener("pagehide", onFreeze);
      document.removeEventListener("visibilitychange", onVisibility);
    };

  }, []);

  return null;
}
