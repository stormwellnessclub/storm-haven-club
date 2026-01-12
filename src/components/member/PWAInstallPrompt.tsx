import { useState, useEffect } from "react";
import { X, Download, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const dismissedDate = new Date(parseInt(dismissedAt));
      const daysSinceDismiss = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        return;
      }
    }

    // Show banner after a delay for iOS users
    if (iOS && !standalone) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      setShowBanner(false);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or no install option available
  if (isStandalone) return null;
  if (!showBanner && !showIOSModal) return null;

  return (
    <>
      {/* Install Banner */}
      {showBanner && (
        <Card className="mx-4 mt-4 bg-gradient-to-r from-gold/10 to-gold/5 border-gold/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-gold/20 shrink-0">
                <Smartphone className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Install Storm Wellness</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add to your home screen for quick access, faster loading, and the full app experience.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    variant="gold" 
                    size="sm" 
                    onClick={handleInstall}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Install App
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDismiss}
                  >
                    Not Now
                  </Button>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0 h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* iOS Installation Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-gold" />
              Install on iPhone/iPad
            </DialogTitle>
            <DialogDescription>
              Follow these steps to add Storm Wellness to your home screen
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground font-semibold text-sm">
                1
              </div>
              <div className="space-y-1">
                <p className="font-medium">Tap the Share button</p>
                <p className="text-sm text-muted-foreground">
                  Find the share icon at the bottom of Safari
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-lg mt-2">
                  <Share className="h-5 w-5" />
                  <span className="text-sm">Share</span>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground font-semibold text-sm">
                2
              </div>
              <div className="space-y-1">
                <p className="font-medium">Tap "Add to Home Screen"</p>
                <p className="text-sm text-muted-foreground">
                  Scroll down in the share menu to find this option
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-lg mt-2">
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Add to Home Screen</span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground font-semibold text-sm">
                3
              </div>
              <div className="space-y-1">
                <p className="font-medium">Tap "Add" to confirm</p>
                <p className="text-sm text-muted-foreground">
                  The app will appear on your home screen like a native app
                </p>
              </div>
            </div>
          </div>

          <Button 
            variant="gold" 
            onClick={() => setShowIOSModal(false)}
            className="w-full"
          >
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
