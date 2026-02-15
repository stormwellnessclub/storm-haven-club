import { useEffect, useRef, useState, useId } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, RotateCcw, Zap, ZapOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface MemberCameraScannerProps {
  onScanSuccess: (memberId: string) => void;
  onScanError?: (error: string) => void;
  fps?: number;
  qrbox?: number;
}

export function MemberCameraScanner({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
}: MemberCameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [flashlightEnabled, setFlashlightEnabled] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const isCleaningUpRef = useRef(false);
  const lastScanTimeRef = useRef<number>(0);
  const SCAN_COOLDOWN_MS = 3000; // 3-second cooldown between scans
  
  // Generate a unique ID for this scanner instance to avoid DOM conflicts
  const uniqueId = useId();
  const scannerElementId = `qr-scanner-${uniqueId.replace(/:/g, "-")}`;

  // Get available cameras with proper cleanup
  useEffect(() => {
    isMountedRef.current = true;

    const getCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        
        // Only update state if still mounted
        if (!isMountedRef.current) return;
        
        if (devices && devices.length > 0) {
          // Prefer back camera for iPad/tablet
          const backCamera = devices.find(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
          );
          setCameraId(backCamera?.id || devices[0].id);
          setHasPermission(true);
        } else {
          setHasPermission(false);
        }
      } catch (error) {
        console.error("Error getting cameras:", error);
        if (isMountedRef.current) {
          setHasPermission(false);
        }
      }
    };

    getCameras();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startScanning = async () => {
    if (!cameraId || !isMountedRef.current || isCleaningUpRef.current) return;
    
    // Check if the element exists
    const element = document.getElementById(scannerElementId);
    if (!element) {
      console.error("Scanner element not found:", scannerElementId);
      return;
    }

    try {
      const scanner = new Html5Qrcode(scannerElementId);
      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps,
          qrbox: { width: qrbox, height: qrbox },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: { ideal: "environment" }, // Prefer back camera
          },
        },
        (decodedText) => {
          // Success callback with cooldown to prevent rapid-fire scans
          const now = Date.now();
          if (now - lastScanTimeRef.current < SCAN_COOLDOWN_MS) return;
          lastScanTimeRef.current = now;
          onScanSuccess(decodedText);
        },
        () => {
          // Error callback - ignore quiet errors (scanning continuously)
        }
      );

      if (isMountedRef.current) {
        setIsScanning(true);
      }
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      if (isMountedRef.current) {
        setIsScanning(false);
        if (onScanError) {
          onScanError(error.message || "Failed to start camera");
        }
      }
    }
  };

  const stopScanning = async () => {
    // Prevent double cleanup
    if (isCleaningUpRef.current) return;
    
    const scanner = scannerRef.current;
    if (!scanner) return;
    
    isCleaningUpRef.current = true;
    scannerRef.current = null; // Clear ref early to prevent re-entry
    
    try {
      await scanner.stop();
    } catch (error) {
      // Ignore stop errors - scanner may already be stopped
      console.log("Stop scanner:", error);
    }
    
    try {
      scanner.clear();
    } catch (error) {
      // Ignore clear errors - DOM may already be gone
      console.log("Clear scanner:", error);
    }
    
    if (isMountedRef.current) {
      setIsScanning(false);
      setFlashlightEnabled(false);
    }
    
    isCleaningUpRef.current = false;
  };

  const toggleFlashlight = async () => {
    if (!scannerRef.current || !isScanning) return;

    try {
      const capabilities = scannerRef.current.getRunningTrackCapabilities();
      // Check if torch is supported
      if (capabilities && (capabilities as any).torch) {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: !flashlightEnabled } as any]
        });
        if (isMountedRef.current) {
          setFlashlightEnabled(!flashlightEnabled);
        }
      } else {
        console.warn("Flashlight/torch not supported on this device");
      }
    } catch (error) {
      console.error("Error toggling flashlight:", error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Capture scanner reference at cleanup time
      const scanner = scannerRef.current;
      if (!scanner) return;
      
      // Prevent other cleanup calls
      isCleaningUpRef.current = true;
      scannerRef.current = null;
      
      // Async cleanup - fire and forget
      scanner
        .stop()
        .then(() => {
          try {
            scanner.clear();
          } catch {
            // Ignore clear errors
          }
        })
        .catch(() => {
          // Ignore all cleanup errors - component is unmounting
        });
    };
  }, []);

  if (hasPermission === false) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CameraOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Camera permission denied. Please enable camera access to use the scanner.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {/* 
            CRITICAL: DOM structure separates html5-qrcode container from React-managed overlay.
            - The outer wrapper is position:relative
            - The scanner host div is EMPTY and owned entirely by html5-qrcode
            - The overlay is a SIBLING (not child) positioned absolute on top
            This prevents html5-qrcode from deleting React nodes when it clears its container.
          */}
          <div
            className="relative w-full bg-black rounded-lg overflow-hidden"
            style={{ minHeight: "400px" }}
          >
            {/* Scanner host - MUST be empty, owned by html5-qrcode */}
            <div
              id={scannerElementId}
              className="w-full h-full"
              style={{ minHeight: "400px" }}
            />
            
            {/* React overlay - separate from scanner host */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted pointer-events-none">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Camera ready</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-center">
        {!isScanning ? (
          <Button onClick={startScanning} size="lg" className="w-full sm:w-auto">
            <Camera className="h-4 w-4 mr-2" />
            Start Camera Scanner
          </Button>
        ) : (
          <>
            <Button onClick={stopScanning} variant="destructive" size="lg" className="flex-1 sm:flex-none">
              <CameraOff className="h-4 w-4 mr-2" />
              Stop
            </Button>
            <Button
              onClick={toggleFlashlight}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-none"
            >
              {flashlightEnabled ? (
                <>
                  <ZapOff className="h-4 w-4 mr-2" />
                  Flash Off
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Flash On
                </>
              )}
            </Button>
            <Button
              onClick={async () => {
                await stopScanning();
                // Small delay to ensure cleanup completes
                setTimeout(startScanning, 150);
              }}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
