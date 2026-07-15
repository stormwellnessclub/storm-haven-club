import { useState, useEffect } from "react";
import { X, Calendar } from "lucide-react";

const STORAGE_KEY = "memorial-day-2026-dismissed";
// Hide after end of Monday May 25, 2026 in America/Detroit (CDT = UTC-5)
const HIDE_AFTER = new Date("2026-05-26T05:00:00Z");

export function MemorialDayHoursBanner() {
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
      className="relative px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5"
      style={{
        background: "linear-gradient(135deg, #0a1a3a 0%, #142a5c 60%, #1f3a7a 100%)",
        borderBottom: "1px solid #c9a86a",
        color: "#f5ecd2",
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: "#e8c878" }} />
        <div className="min-w-0">
          <div className="font-serif text-base sm:text-lg leading-tight" style={{ color: "#f5ecd2" }}>
            Memorial Day Weekend Hours
          </div>
          <div className="text-xs sm:text-sm mt-0.5 flex flex-col sm:flex-row sm:gap-4" style={{ color: "#d8c89a" }}>
            <span><strong style={{ color: "#f5ecd2" }}>Sun, May 24</strong> · 8:00 AM – 5:00 PM</span>
            <span><strong style={{ color: "#f5ecd2" }}>Mon, May 25</strong> (Memorial Day) · 7:00 AM – 5:00 PM</span>
          </div>
          <div className="text-[11px] mt-0.5 italic" style={{ color: "#b8a878" }}>
            Regular hours resume Tuesday.
          </div>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 transition"
        style={{ color: "#c9a86a" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
