import { useState, useEffect } from "react";
import { Check, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraftSaveIndicatorProps {
  lastSavedAt: number | null;
}

export function DraftSaveIndicator({ lastSavedAt }: DraftSaveIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;

    // Show "saved" animation briefly
    setShowSaved(true);
    const hideTimer = setTimeout(() => setShowSaved(false), 2000);

    // Update time ago
    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastSavedAt) / 1000);
      if (seconds < 5) {
        setTimeAgo("just now");
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);

    return () => {
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, [lastSavedAt]);

  if (!lastSavedAt) return null;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-background border shadow-lg transition-all duration-300",
      showSaved ? "opacity-100 scale-100" : "opacity-70 scale-95"
    )}>
      {showSaved ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Cloud className="w-4 h-4 text-muted-foreground" />
      )}
      <span className="text-xs text-muted-foreground">
        {showSaved ? "Draft saved" : `Saved ${timeAgo}`}
      </span>
    </div>
  );
}
