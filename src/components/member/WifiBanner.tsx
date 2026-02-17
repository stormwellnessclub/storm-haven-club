import { useState } from "react";
import { Wifi, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "wifi-banner-dismissed";
const WIFI_PASSWORD = "WelcomeTribe";

export function WifiBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(WIFI_PASSWORD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gold/10 border-b border-gold/30">
      <div className="max-w-3xl mx-auto px-4 py-4 relative">
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-foreground/60 hover:text-foreground"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-3 pr-8">
          <div className="mt-0.5 rounded-full bg-gold/20 p-2 shrink-0">
            <Wifi className="h-4 w-4 text-gold" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-sm font-semibold text-foreground">
              WiFi Access
            </h3>
            <p className="text-sm text-muted-foreground">
              There are different WiFi areas throughout the space. Connect to the
              local network when you enter each area — you only need to do this
              once per zone.
            </p>
            <div className="flex items-center gap-2">
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
        </div>
      </div>
    </div>
  );
}
