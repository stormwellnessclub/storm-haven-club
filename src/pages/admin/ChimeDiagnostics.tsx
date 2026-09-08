import { useEffect, useState, useSyncExternalStore } from "react";
import { Activity, BellRing, CheckCircle2, CircleAlert, MonitorSpeaker, Radio, Volume2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useStationNotifications } from "@/components/admin/StationNotificationProvider";
import {
  getChimeEngineSnapshot,
  runChimeDiagnostics,
  setIsMuted,
  subscribeChimeEngine,
  unlockChimeAudio,
  type ChimePlayResult,
} from "@/components/admin/AdminSupportChime";

type DeviceInfo = { label: string; id: string };

export default function ChimeDiagnostics() {
  const engine = useSyncExternalStore(subscribeChimeEngine, getChimeEngineSnapshot, getChimeEngineSnapshot);
  const { supportStatus, cafeStatus } = useStationNotifications();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ChimePlayResult | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then((list) => {
      setDevices(list.filter((device) => device.kind === "audiooutput").map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Speaker output ${index + 1}`,
      })));
    }).catch(() => setDevices([]));
  }, []);

  const runTest = async () => {
    setTesting(true);
    setIsMuted(false);
    await unlockChimeAudio();
    const result = await runChimeDiagnostics();
    setTestResult(result.result);
    setTesting(false);
  };

  const ready = engine.state === "ready";
  return (
    <AdminLayout title="Chime Diagnostics">
      <div className="mx-auto max-w-5xl space-y-6">
        <Alert variant={ready ? "default" : "destructive"}>
          {ready ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
          <AlertTitle>{ready ? "Notification sound is ready" : "Notification sound needs attention"}</AlertTitle>
          <AlertDescription>
            {ready
              ? "The browser audio engine is active. Use the full test to confirm the selected speakers can be heard."
              : "Click Run full test. This user action lets the browser unlock its sound engine and records exactly where playback fails."}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5" /> Sound engine</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusRow label="Sound status" value={engine.state} good={ready} />
              <StatusRow label="Browser engine" value={engine.contextState} good={engine.contextState === "running"} />
              <StatusRow label="Missed alerts queued" value={String(engine.pendingAlerts)} good={engine.pendingAlerts === 0} />
              <Button className="w-full gap-2" onClick={runTest} disabled={testing}>
                <BellRing className="h-4 w-4" />
                {testing ? "Testing…" : "Run full sound test"}
              </Button>
              {testResult && (
                <p className={testResult === "played" ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-destructive"}>
                  {testResult === "played"
                    ? "The browser produced the test tone. If you did not hear it, Chrome or Windows is sending this tab to the wrong speaker output."
                    : "The browser blocked both sound methods. Click the lock icon beside the website address, set Sound to Allow, then run the test again."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Alert connection</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusRow label="Member messages" value={supportStatus} good={supportStatus === "connected"} />
              <StatusRow label="Café orders" value={cafeStatus} good={cafeStatus === "connected"} />
              <p className="text-muted-foreground">These connections must both say connected for new alerts to arrive instantly. The app also checks periodically if either connection drops.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MonitorSpeaker className="h-5 w-5" /> Speaker output</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {devices.length > 0 ? devices.map((device) => (
              <div key={device.id || device.label} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <span>{device.label}</span>
                <Badge variant="outline">Available</Badge>
              </div>
            )) : <p className="text-muted-foreground">Chrome has not shared the speaker name. Run the full test once, then reload this page.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent sound attempts</CardTitle></CardHeader>
          <CardContent>
            {engine.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sound attempts recorded in this tab yet.</p>
            ) : (
              <div className="space-y-2">
                {engine.attempts.map((attempt, index) => (
                  <div key={`${attempt.at}-${index}`} className="grid gap-1 border-b border-border py-2 text-sm last:border-0 sm:grid-cols-[9rem_7rem_1fr]">
                    <span>{new Date(attempt.at).toLocaleTimeString()}</span>
                    <Badge variant={attempt.result === "played" ? "secondary" : "destructive"} className="w-fit">{attempt.method}: {attempt.result}</Badge>
                    <span className="text-muted-foreground">{attempt.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
      <span>{label}</span>
      <Badge variant={good ? "secondary" : "destructive"}>{value}</Badge>
    </div>
  );
}