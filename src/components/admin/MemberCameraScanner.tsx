import { useEffect, useRef, useState } from "react";
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
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

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
    if (!cameraId || !scannerContainerRef.current || !isMountedRef.current) return;

    try {
      const scanner = new Html5Qrcode(scannerContainerRef.current.id);
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
          // Success callback
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Error callback - ignore quiet errors
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
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
        if (isMountedRef.current) {
          setIsScanning(false);
          setFlashlightEnabled(false);
        }
      } catch (error) {
        // Ignore errors during cleanup - DOM may already be gone
        console.log("Stop scanning:", error);
      }
    }
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

  // Cleanup on unmount - use ref, no state dependencies
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Use scannerRef directly without checking isScanning state
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            if (scannerRef.current) {
              scannerRef.current.clear();
            }
          })
          .catch((err) => {
            // Ignore errors during cleanup - DOM may already be gone
            console.log("Scanner cleanup:", err.message);
          });
      }
    };
  }, []); // Empty dependency array

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
          <div
            id="qr-reader"
            ref={scannerContainerRef}
            className="relative w-full bg-black rounded-lg overflow-hidden"
            style={{ minHeight: "400px", position: "relative" }}
          >
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
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
              onClick={() => {
                stopScanning();
                setTimeout(startScanning, 100);
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
