import { useState } from "react";
import { Wifi, X, Copy, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "wifi-banner-dismissed";
const WIFI_PASSWORD = "WelcomeTribe";

export function WifiBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(WIFI_PASSWORD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gold/10 border-b border-gold/30">
      <div className="max-w-3xl mx-auto px-4 relative">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 py-2 text-left"
          aria-expanded={expanded}
        >
          <div className="rounded-full bg-gold/20 p-1.5 shrink-0">
            <Wifi className="h-3.5 w-3.5 text-gold" />
          </div>
          <span className="text-xs font-medium text-foreground flex-1">
            WiFi Access {expanded ? "" : "— tap for password"}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-foreground/60 hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </button>

        {expanded && (
          <div className="pb-4 pl-8 pr-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              There are different WiFi areas throughout the space. Connect to the
              local network when you enter each area — you only need to do this
              once per zone.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-foreground/80">
                Password for all areas:
              </span>
              <code className="font-mono font-bold text-sm text-foreground bg-gold/15 px-2 py-0.5 rounded">
                {WIFI_PASSWORD}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                aria-label="Copy password"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
