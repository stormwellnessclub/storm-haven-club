import { useEffect } from "react";
import { isAudioBlocked, unlockChimeAudio } from "./AdminSupportChime";

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
    };

    // Even with no interaction at all, keep re-waking the engine. Laptops that
    // sleep or switch audio devices leave it suspended, which is exactly the
    // "worked for a while, then went quiet" case.
    const watchdog = setInterval(() => {
      if (isAudioBlocked()) void unlockChimeAudio();
    }, 20_000);

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    window.addEventListener("focus", unlock);
    window.addEventListener("online", unlock);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(watchdog);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("focus", unlock);
      window.removeEventListener("online", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
    };

  }, []);

  return null;
}
