import { useEffect } from "react";
import { unlockChimeAudio } from "./AdminSupportChime";

/**
 * Browsers block audio until the user has interacted with the page.
 * On the first pointerdown/keydown anywhere in the admin layout, wake the
 * SHARED audio engine the chime actually uses (plus a silent <audio> element)
 * so subsequent chimes are heard — including the very first realtime
 * notification of the session.
 */
export function AudioUnlocker() {
  useEffect(() => {
    let unlocked = false;

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;

      // 1) Wake the shared WebAudio context used by playNotificationChime()
      unlockChimeAudio();

      // 2) Play a silent <audio> element (covers HTMLAudio fallback path)
      try {
        const silent =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        const a = new Audio(silent);
        a.volume = 0;
        a.play().catch(() => {});
      } catch (e) {
        console.warn("AudioUnlocker failed:", e);
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return null;
}
