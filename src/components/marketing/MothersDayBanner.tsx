import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { X, Heart } from "lucide-react";

const STORAGE_KEY = "mothers-day-banner-dismissed-2026";
const HIDE_AFTER = new Date("2026-05-11T00:00:00-05:00"); // hide after Mother's Day

export function MothersDayBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (new Date() > HIDE_AFTER) return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      className="relative rounded-lg overflow-hidden mb-6 px-5 py-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6"
      style={{ background: "linear-gradient(135deg, #ece2d2 0%, #e0d2b8 100%)", border: "1px solid #c9a86a" }}
    >
      <div className="flex items-center gap-3 flex-1 text-center sm:text-left">
        <Heart className="w-6 h-6 hidden sm:block flex-shrink-0" style={{ color: "#a17e3a" }} />
        <div>
          <div className="font-serif text-lg sm:text-xl" style={{ color: "#a17e3a" }}>
            Mother's Day Special
          </div>
          <div className="text-sm" style={{ color: "#6b5a3b" }}>
            Custom Massage + Exclusive Wet Spa Access (Sauna · Steam · Himalayan Salt Room). Redeemable for 6 months.
          </div>
        </div>
      </div>
      <Link
        to="/mothers-day"
        className="inline-flex items-center px-5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition hover:opacity-90"
        style={{ background: "#a17e3a", color: "#fff" }}
      >
        View Special
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 rounded hover:bg-black/5"
        style={{ color: "#8a6d3b" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
