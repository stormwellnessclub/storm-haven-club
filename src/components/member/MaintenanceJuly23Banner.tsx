import { useState, useEffect } from "react";
import { X, Wrench } from "lucide-react";

const STORAGE_KEY = "maint-jul-23-2026-dismissed";
// Hide after end of Thursday July 23, 2026 in America/Detroit (EDT = UTC-4)
const HIDE_AFTER = new Date("2026-07-24T04:00:00Z");

export function MaintenanceJuly23Banner() {
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
      className="relative px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
      style={{
        background: "linear-gradient(135deg, #2a1a05 0%, #4a2f10 60%, #6b4620 100%)",
        borderBottom: "2px solid #c9a86a",
        color: "#f5ecd2",
      }}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className="flex-shrink-0 rounded-full p-3"
          style={{ background: "rgba(232,200,120,0.15)", border: "1px solid #c9a86a" }}
        >
          <Wrench className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: "#e8c878" }} />
        </div>
        <div className="min-w-0">
          <div className="font-serif text-lg sm:text-2xl leading-tight" style={{ color: "#f5ecd2" }}>
            Thursday, July 23 — Scheduled Maintenance
          </div>
          <div className="text-sm sm:text-base mt-1.5" style={{ color: "#e0d0a2" }}>
            We'll open at <strong style={{ color: "#f5ecd2" }}>7:30 AM</strong> for required interior maintenance. A second window from{" "}
            <strong style={{ color: "#f5ecd2" }}>2–4 PM</strong> needs about one hour of limited access to one locker room.
          </div>
          <div className="text-xs sm:text-sm mt-1.5 italic" style={{ color: "#b8a878" }}>
            All other amenities and the facility remain fully open. Thank you for your patience.
          </div>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 p-1.5 rounded hover:bg-white/10 transition"
        style={{ color: "#c9a86a" }}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

