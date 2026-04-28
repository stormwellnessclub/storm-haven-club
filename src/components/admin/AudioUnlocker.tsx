import { useEffect } from "react";

/**
 * Browsers block Audio.play() until the user has interacted with the page.
 * On the first pointerdown/keydown anywhere in the admin layout, play a
 * silent audio buffer to "unlock" autoplay so subsequent chimes are heard
 * — including the very first realtime notification of the session.
 */
export function AudioUnlocker() {
  useEffect(() => {
    let unlocked = false;

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;

      try {
        // 1) Resume an AudioContext (covers WebAudio paths)
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          if (ctx.state === "suspended") ctx.resume().catch(() => {});
          // Play a silent buffer
          const buffer = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(ctx.destination);
          src.start(0);
        }

        // 2) Play a silent <audio> element (covers HTMLAudio paths)
        const silent =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        const a = new Audio(silent);
        a.volume = 0;
        a.play().catch(() => {});
      } catch (e) {
        // Best-effort only
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
