import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Keyboard,
  Clock,
  User,
  ShieldAlert,
  DollarSign,
  Calendar,
  Loader2,
  Settings,
  ImageOff,
  RotateCcw,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMemberScanner, useRecentScans, ScanResult, DeviceType } from "@/hooks/useMemberScanner";
import { useScannerSettings, useUpdateScannerSettings } from "@/hooks/useScannerSettings";
import { useKioskCheckIn } from "@/hooks/useKioskCheckIn";
import { useSyncMemberStatus } from "@/hooks/usePaymentTracking";
import { MemberCameraScanner } from "@/components/admin/MemberCameraScanner";
import { format, parse } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { EffectiveStatusBadge } from "@/components/admin/EffectiveStatusBadge";
import { toast } from "sonner";
import { Snowflake, RefreshCcw } from "lucide-react";
import { SignedMemberPhoto } from "@/components/member/SignedMemberPhoto";

export default function Scanner() {
  const [memberIdInput, setMemberIdInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [autoCheckIn, setAutoCheckIn] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingScan, setPendingScan] = useState<{ memberId: string; deviceType: DeviceType } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  const { scanMember, scanMemberAsync, isScanning } = useMemberScanner();
  const syncMemberStatus = useSyncMemberStatus();
  const { data: recentScans } = useRecentScans(10);
  const { data: settings } = useScannerSettings("front_desk");
  const updateSettings = useUpdateScannerSettings();
  const { checkInClass, checkInSpa, isCheckingIn } = useKioskCheckIn();

  const handleFrozenClassCheckIn = async (bookingId: string, label: string) => {
    const ok = await checkInClass(bookingId);
    if (ok) {
      toast.success(`Checked in for ${label}`);
      setScanResult(null);
      setMemberIdInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleFrozenSpaCheckIn = async (spaId: string, label: string) => {
    const ok = await checkInSpa(spaId);
    if (ok) {
      toast.success(`Checked in for ${label}`);
      setScanResult(null);
      setMemberIdInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const formatTime = (t: string) => {
    try {
      return format(parse(t.slice(0, 8), "HH:mm:ss", new Date()), "h:mm a");
    } catch {
      return t;
    }
  };

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setAutoCheckIn(settings.auto_check_in_enabled);
    }
  }, [settings]);

  // Auto-focus input field on mount and after scans
  useEffect(() => {
    if (inputRef.current && !showCamera) {
      inputRef.current.focus();
    }
  }, [showCamera, scanResult]);

  // Play audio feedback
  const playAudio = (type: "success" | "error") => {
    if (settings?.audio_feedback_enabled !== false) {
      const audio = new Audio();
      if (type === "success") {
        // Success beep (higher frequency)
        audio.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURAIQJfd8sN0KAUxh9Hz04IzBh5uwO/jmVEQ";
      } else {
        // Error tone (lower frequency)
        audio.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURAIQJfd8sN0KAUxh9Hz04IzBh5uwO/jmVEQ";
      }
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (e.g., autoplay restrictions)
      });
    }
  };

  // Handle scan from input field (physical scanner or manual entry)
  const handleInputScan = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Determine device type based on input speed (scanners type very fast)
    const deviceType: DeviceType = "physical_scanner"; // Default, but could detect based on timing

    await processScan(trimmed, deviceType);
    setMemberIdInput("");
  };

  // Handle scan from camera
  const handleCameraScan = async (memberId: string) => {
    await processScan(memberId, "camera");
  };

  // Process the scan with guard against concurrent processing
  const processScan = async (memberId: string, deviceType: DeviceType) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      const result = await scanMemberAsync({
        memberId,
        deviceType,
        autoCheckIn,
        override: false,
      });

      setScanResult(result);

      // Play audio feedback
      if (result.access_granted) {
        playAudio("success");
      } else {
        playAudio("error");
      }

      // Clear result after 5 seconds
      setTimeout(() => {
        setScanResult(null);
      }, 5000);
    } catch (error: any) {
      console.error("Scan error:", error);
      setScanResult({
        success: false,
        access_granted: false,
        error: error.message || "Scan failed",
      });
      playAudio("error");
    } finally {
      // Reset processing guard after a short delay
      setTimeout(() => { isProcessingRef.current = false; }, 2000);
    }
  };

  // Handle input change with debouncing for physical scanners
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMemberIdInput(value);

    // If scanner typically sends Enter after scan, detect Enter key
    // For now, we'll detect when input is complete (scanner usually sends Enter)
  };

  // Handle Enter key or when scanner completes (typically sends Enter)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && memberIdInput.trim()) {
      e.preventDefault();
      handleInputScan(memberIdInput);
    }
  };

  // Handle override
  const handleOverride = async () => {
    if (!pendingScan) return;

    try {
      const result = await scanMemberAsync({
        memberId: pendingScan.memberId,
        deviceType: pendingScan.deviceType,
        autoCheckIn,
        override: true,
        overrideReason: overrideReason.trim() || undefined,
      });

      setScanResult(result);
      setShowOverrideDialog(false);
      setOverrideReason("");
      setPendingScan(null);

      if (result.access_granted) {
        playAudio("success");
      }
    } catch (error: any) {
      console.error("Override error:", error);
      setShowOverrideDialog(false);
      setPendingScan(null);
    }
  };

  // Update settings when auto-check-in toggles
  const handleAutoCheckInToggle = (checked: boolean) => {
    setAutoCheckIn(checked);
    if (settings) {
      updateSettings.mutate({
        locationName: "front_desk",
        updates: { auto_check_in_enabled: checked },
      });
    }
  };

  const getDenialMessage = (reason?: string) => {
    if (!reason) return "Access denied";
    const reasons: Record<string, string> = {
      payment_failed: "Payment Failed — Recent payment was declined",
      payment_overdue: "Payment Overdue — Monthly dues past due",
      no_active_subscription: "No Active Subscription — Member has no recurring billing",
      subscription_incomplete: "Subscription Failed — Initial payment never completed",
      annual_fee_overdue: "Annual Fee Overdue — Initiation fee not paid",
      pending_activation: "Pending Activation — Awaiting first payment",
      membership_expired: "Membership Expired",
      membership_cancelled: "Membership Cancelled",
      membership_frozen: "Membership Frozen",
      membership_suspended: "Membership Suspended",
      access_revoked: "ACCESS REVOKED — This person is on the block list",
    };
    return reasons[reason] || reason.replace(/_/g, " ");
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Member Scanner</h1>
          <p className="text-muted-foreground mt-1">
            Scan member IDs to verify access and optionally check in members
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Scanner Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scanner Input Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5" />
                  Scan Member ID
                </CardTitle>
                <CardDescription>
                  Use a physical scanner, camera, or type member ID manually (e.g., STM-000001)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggle between input and camera */}
                <div className="flex gap-2">
                  <Button
                    variant={!showCamera ? "default" : "outline"}
                    onClick={() => {
                      setShowCamera(false);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    className="flex-1"
                  >
                    <Keyboard className="h-4 w-4 mr-2" />
                    Scanner/Manual
                  </Button>
                  <Button
                    variant={showCamera ? "default" : "outline"}
                    onClick={() => setShowCamera(true)}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Camera
                  </Button>
                </div>

                {!showCamera ? (
                  <div className="space-y-2">
                    <Input
                      ref={inputRef}
                      type="text"
                      placeholder="Scan or type member ID (STM-000001)"
                      value={memberIdInput}
                      onChange={handleInputChange}
                      onKeyPress={handleKeyPress}
                      className="text-lg h-14 text-center"
                      disabled={isScanning}
                      autoFocus
                    />
                    <p className="text-xs text-center text-muted-foreground">
                      Press Enter or scan member ID card
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cameraError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Camera Error</AlertTitle>
                        <AlertDescription className="flex flex-col gap-2">
                          <span>{cameraError}</span>
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCameraError(null);
                                setShowCamera(false);
                                setTimeout(() => inputRef.current?.focus(), 100);
                              }}
                            >
                              <Keyboard className="h-4 w-4 mr-1" />
                              Use Scanner/Manual
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCameraError(null);
                                // Force remount by toggling
                                setShowCamera(false);
                                setTimeout(() => setShowCamera(true), 100);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Retry Camera
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    <MemberCameraScanner
                      onScanSuccess={handleCameraScan}
                      onScanError={(error) => {
                        console.error("Camera scan error:", error);
                        setCameraError(error);
                      }}
                    />
                  </div>
                )}

                {/* Auto Check-In Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-checkin">Auto Check-In</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically check in members on successful scan
                    </p>
                  </div>
                  <Switch
                    id="auto-checkin"
                    checked={autoCheckIn}
                    onCheckedChange={handleAutoCheckInToggle}
                    disabled={updateSettings.isPending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Scan Result Display */}
            {scanResult && (
              <Card>
                <CardContent className="p-6">
                {scanResult.access_granted ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-10 w-10" />
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold">Access Granted</h3>
                          {scanResult.member && (
                            <p className="text-sm">
                              {scanResult.member.first_name} {scanResult.member.last_name}
                            </p>
                          )}
                        </div>
                        {/* Member Photo */}
                        {scanResult.member && (
                          <Avatar className="h-16 w-16 border-2 border-green-500/30">
                            <SignedMemberPhoto
                              photoUrl={scanResult.member.photo_url}
                              alt={`${scanResult.member.first_name} ${scanResult.member.last_name}`}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-green-100 dark:bg-green-900 text-lg">
                              {(scanResult.member.first_name?.[0] || "") + (scanResult.member.last_name?.[0] || "")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      {scanResult.member && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Member ID</p>
                            <p className="font-medium">{scanResult.member.member_id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Membership</p>
                            <Badge variant="outline">{scanResult.member.membership_type}</Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <EffectiveStatusBadge
                              memberStatus={scanResult.member.status}
                              size="sm"
                              showTooltip={false}
                            />
                          </div>
                          {scanResult.check_in_id && (
                            <div>
                              <p className="text-xs text-muted-foreground">Checked In</p>
                              <p className="font-medium text-green-600">✓ Yes</p>
                            </div>
                          )}
                        </div>
                      )}
                      {/* No Photo Warning */}
                      {scanResult.member && !scanResult.member.photo_url && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-amber-700 dark:text-amber-300 text-sm">
                          <ImageOff className="h-4 w-4" />
                          <span>No profile photo - verify identity manually</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 text-destructive">
                        <XCircle className="h-10 w-10" />
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold">Access Denied</h3>
                          <p className="text-sm">{getDenialMessage(scanResult.denial_reason)}</p>
                        </div>
                        {/* Member Photo */}
                        {scanResult.member && (
                          <Avatar className="h-16 w-16 border-2 border-destructive/30">
                            <SignedMemberPhoto
                              photoUrl={scanResult.member.photo_url}
                              alt={`${scanResult.member.first_name} ${scanResult.member.last_name}`}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-red-100 dark:bg-red-900 text-lg">
                              {(scanResult.member.first_name?.[0] || "") + (scanResult.member.last_name?.[0] || "")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>

                      {scanResult.member && (
                        <div className="space-y-2 pt-4 border-t">
                          <p className="text-sm font-medium">
                            {scanResult.member.first_name} {scanResult.member.last_name}
                          </p>
                          <div className="space-y-1 text-sm">
                            {scanResult.payment_status?.hasRecentFailedPayment && (
                              <div className="flex items-center gap-2 text-destructive">
                                <DollarSign className="h-4 w-4" />
                                Recent payment declined
                              </div>
                            )}
                            {scanResult.payment_status?.isDuesPastDue && (
                              <div className="flex items-center gap-2 text-destructive">
                                <DollarSign className="h-4 w-4" />
                                Monthly dues past due
                              </div>
                            )}
                            {scanResult.payment_status?.isAnnualFeeOverdue && (
                              <div className="flex items-center gap-2 text-destructive">
                                <Calendar className="h-4 w-4" />
                                Annual fee overdue
                              </div>
                            )}
                            {scanResult.payment_status?.hasNoSubscription && (
                              <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                No active subscription
                              </div>
                            )}
                            {scanResult.payment_status?.hasIncompleteSubscription && (
                              <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                Subscription payment failed
                              </div>
                            )}
                            {scanResult.denial_reason === "membership_frozen" && (
                              <div className="flex items-center gap-2 text-amber-600">
                                <Snowflake className="h-4 w-4" />
                                Membership is frozen — billing paused
                              </div>
                            )}
                            {(scanResult.denial_reason === "membership_expired" ||
                              scanResult.denial_reason === "membership_cancelled") && (
                              <div className="flex items-center gap-2 text-destructive">
                                <XCircle className="h-4 w-4" />
                                Membership {scanResult.denial_reason.replace("membership_", "")}
                              </div>
                            )}
                            {scanResult.denial_reason === "access_revoked" && (
                              <div className="flex items-center gap-2 text-destructive font-semibold">
                                <ShieldAlert className="h-4 w-4" />
                                ACCESS REVOKED — Do not admit
                              </div>
                            )}
                          </div>

                          {/* Show billing block message - no override available */}
                          {scanResult.is_billing_block && (
                            <p className="text-xs text-destructive font-medium mt-2">
                              Billing issue must be resolved before entry. Override is not available.
                            </p>
                          )}

                          {/* Sync from Stripe — recover from stale DB after a payment was fixed in Stripe */}
                          {scanResult.member && scanResult.denial_reason?.startsWith("subscription_") && (
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={syncMemberStatus.isPending}
                                onClick={async () => {
                                  const memberUuid = scanResult.member!.id;
                                  const memberCode = scanResult.member!.member_id;
                                  try {
                                    await syncMemberStatus.mutateAsync(memberUuid);
                                    toast.success("Synced from Stripe — re-scanning");
                                    await processScan(memberCode, "manual_entry");
                                  } catch (e: any) {
                                    toast.error(e?.message || "Sync failed");
                                  }
                                }}
                              >
                                <RefreshCcw
                                  className={`h-4 w-4 mr-2 ${syncMemberStatus.isPending ? "animate-spin" : ""}`}
                                />
                                Sync from Stripe & retry
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                Use after fixing the payment in Stripe
                              </span>
                            </div>
                          )}

                          {/* Frozen-member: contextual manual check-in for paid bookings */}
                          {scanResult.denial_reason === "membership_frozen" && (
                            <div className="mt-4 space-y-3 border-t pt-4">
                              <p className="text-sm font-medium text-foreground">
                                Manual Check-In (membership-only benefits paused)
                              </p>

                              {/* Today's class bookings */}
                              {scanResult.todays_class_bookings && scanResult.todays_class_bookings.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Today's classes</p>
                                  {scanResult.todays_class_bookings.map((b) => (
                                    <Button
                                      key={b.id}
                                      variant={b.already_checked_in ? "ghost" : "default"}
                                      className="w-full justify-between h-auto py-3"
                                      disabled={b.already_checked_in || isCheckingIn}
                                      onClick={() => handleFrozenClassCheckIn(b.id, `${b.class_name} @ ${formatTime(b.start_time)}`)}
                                    >
                                      <span className="flex items-center gap-2 text-left">
                                        <Calendar className="h-4 w-4 shrink-0" />
                                        <span className="flex flex-col">
                                          <span className="font-medium">{b.class_name}</span>
                                          <span className="text-xs opacity-80">
                                            {formatTime(b.start_time)}{b.room ? ` · ${b.room}` : ""}
                                          </span>
                                        </span>
                                      </span>
                                      <span className="text-xs">
                                        {b.already_checked_in ? "Already checked in" : "Check In"}
                                      </span>
                                    </Button>
                                  ))}
                                </div>
                              )}

                              {/* Today's spa appointments */}
                              {scanResult.todays_spa_bookings && scanResult.todays_spa_bookings.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Today's spa</p>
                                  {scanResult.todays_spa_bookings.map((s) => (
                                    <Button
                                      key={s.id}
                                      variant={s.already_checked_in ? "ghost" : "default"}
                                      className="w-full justify-between h-auto py-3"
                                      disabled={s.already_checked_in || isCheckingIn}
                                      onClick={() => handleFrozenSpaCheckIn(s.id, `${s.service_name} @ ${formatTime(s.appointment_time)}`)}
                                    >
                                      <span className="flex items-center gap-2 text-left">
                                        <Clock className="h-4 w-4 shrink-0" />
                                        <span className="flex flex-col">
                                          <span className="font-medium">{s.service_name}</span>
                                          <span className="text-xs opacity-80">
                                            {formatTime(s.appointment_time)}{s.therapist ? ` · ${s.therapist}` : ""}
                                          </span>
                                        </span>
                                      </span>
                                      <span className="text-xs">
                                        {s.already_checked_in ? "Already checked in" : "Check In"}
                                      </span>
                                    </Button>
                                  ))}
                                </div>
                              )}

                              {/* No bookings today */}
                              {(!scanResult.todays_class_bookings || scanResult.todays_class_bookings.length === 0) &&
                               (!scanResult.todays_spa_bookings || scanResult.todays_spa_bookings.length === 0) && (
                                <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    No paid class or spa booking for today.
                                    {typeof scanResult.valid_class_passes === "number" && scanResult.valid_class_passes > 0
                                      ? ` Member has ${scanResult.valid_class_passes} class pass${scanResult.valid_class_passes === 1 ? "" : "es"} remaining — book them into a class first, or collect non-member payment before entry.`
                                      : " Collect non-member payment before entry."}
                                  </AlertDescription>
                                </Alert>
                              )}

                              {/* Last-resort override link */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setPendingScan({
                                    memberId: scanResult.member!.member_id,
                                    deviceType: "manual_entry",
                                  });
                                  setShowOverrideDialog(true);
                                }}
                              >
                                <ShieldAlert className="h-3 w-3 mr-2" />
                                Override entry (last resort)
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Override button — only for non-billing, non-terminal, non-frozen denials */}
                      {scanResult.member &&
                        !scanResult.is_billing_block &&
                        scanResult.denial_reason !== "membership_expired" &&
                        scanResult.denial_reason !== "membership_cancelled" &&
                        scanResult.denial_reason !== "access_revoked" &&
                        scanResult.denial_reason !== "membership_frozen" && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setPendingScan({
                                memberId: scanResult.member!.member_id,
                                deviceType: "manual_entry",
                              });
                              setShowOverrideDialog(true);
                            }}
                          >
                            <ShieldAlert className="h-4 w-4 mr-2" />
                            Override Access (Staff Only)
                          </Button>
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isScanning && !scanResult && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-accent" />
                  <p className="text-sm text-muted-foreground">Processing scan...</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Scans Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentScans && recentScans.length > 0 ? (
                  <div className="space-y-2">
                    {recentScans.map((scan) => (
                      <div
                        key={scan.id}
                        className={`p-3 rounded-lg border ${
                          scan.access_granted
                            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {scan.members
                                ? `${scan.members.first_name} ${scan.members.last_name}`
                                : scan.member_id_text}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(scan.scanned_at), "h:mm a")}
                            </p>
                          </div>
                          {scan.access_granted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                        </div>
                        {scan.override_used && (
                          <p className="text-xs text-amber-600 mt-1">Override used</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No scans yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Access</DialogTitle>
            <DialogDescription>
              Override access denial. This action will be logged for accountability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="override-reason">Reason (Optional)</Label>
              <Textarea
                id="override-reason"
                placeholder="Enter reason for override..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleOverride} variant="default">
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

