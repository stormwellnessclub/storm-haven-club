import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lands on the section named in the link (#book, #facials…) and keeps it in place while photos
 * above it finish loading, so a "Book" link never leaves the visitor partway up the page.
 * Stops as soon as the visitor scrolls or taps.
 */
export function useHashScroll(settleMs = 3000) {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const stop = () => { stopped = true; };
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchstart", stop, opts);
    window.addEventListener("keydown", stop);
    const started = Date.now();
    const tick = () => {
      if (stopped) return;
      const el = document.getElementById(id);
      if (el) {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const off = el.getBoundingClientRect().top - margin;
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        if (Math.abs(off) > 4 && !(off > 0 && atBottom)) el.scrollIntoView();
      }
      if (Date.now() - started < settleMs) timer = setTimeout(tick, 120);
    };
    timer = setTimeout(tick, 60);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [hash, pathname, settleMs]);
}
