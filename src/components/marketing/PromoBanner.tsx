import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { X, Gift } from "lucide-react";

const STORAGE_KEY = "class-pass-promo-banner-dismissed";
const MOTHERS_DAY_END = new Date("2026-05-13T05:00:00Z"); // end of May 12 in America/Detroit

export function PromoBanner({ className = "" }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [isMD, setIsMD] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    setIsMD(new Date() < MOTHERS_DAY_END);
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const text = isMD
    ? "Mother's Day Class Pack — gift 10 classes for $150 (member) or $265 (non-member)"
    : "Gift a 10-class pack to a Storm Wellness Club member";

  return (
    <div
      className={`relative w-full px-4 sm:px-6 py-2.5 flex items-center justify-center gap-3 text-sm ${className}`}
      style={{ background: "linear-gradient(135deg, #2d2418 0%, #3a2e1a 100%)", color: "#e8d5a8", borderBottom: "1px solid #a17e3a" }}
    >
      <Gift className="w-4 h-4 flex-shrink-0 hidden sm:block" />
      <span className="text-center leading-snug">{text}</span>
      <Link
        to="/class-passes#mothers-day"
        className="ml-2 px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
        style={{ background: "#a17e3a", color: "#fff" }}
      >
        {isMD ? "Shop now" : "Send a gift"}
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
        style={{ color: "#c9a86a" }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
