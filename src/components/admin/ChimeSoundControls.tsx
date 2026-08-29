import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Volume2, VolumeX, Play, BellRing, Music } from "lucide-react";
import { toast } from "sonner";
import {
  getIsMuted,
  setIsMuted,
  getChimeVolume,
  setChimeVolume,
  getChimeSound,
  setChimeSound,
  CHIME_SOUNDS,
  playNotificationChime,
  unlockChimeAudio,
  isAudioBlocked,
  type ChimeVolume,
  type ChimeSound,
} from "./AdminSupportChime";

const LEVELS: Array<{ value: ChimeVolume; label: string; hint: string }> = [
  { value: "quiet", label: "Quiet", hint: "Soft — for a private office" },
  { value: "normal", label: "Normal", hint: "Standard notification level" },
  { value: "loud", label: "Loud", hint: "Carries across reception" },
];


/**
 * Shared notification-sound controls: unlock prompt, test, mute, volume.
 * Used by the admin header, the front desk shell and the kiosk shell so every
 * station can verify and adjust the concierge bell.
 */
export function ChimeSoundControls({ compact = false }: { compact?: boolean }) {
  const [muted, setMuted] = useState(getIsMuted);
  const [volume, setVolume] = useState<ChimeVolume>(getChimeVolume);
  const [sound, setSound] = useState<ChimeSound>(getChimeSound);
  const [audioBlocked, setAudioBlocked] = useState(false);


  useEffect(() => {
    const check = () => setAudioBlocked(isAudioBlocked());
    check();
    const id = setInterval(check, 2000);
    return () => clearInterval(id);
  }, []);

  const reportResult = (result: string) => {
    setAudioBlocked(isAudioBlocked());
    if (result === "played") {
      toast.success("Chime played");
    } else {
      toast.error(
        "No sound came out — your browser or device is blocking it. Check the tab isn't muted and the volume is up.",
        { duration: 8000 }
      );
    }
  };

  const test = async () => {
    await unlockChimeAudio();
    const result = await playNotificationChime();
    reportResult(result);
  };

  const toggleMute = () => {
    const next = !muted;
    setIsMuted(next);
    setMuted(next);
  };

  return (
    <div className="flex items-center gap-1">
      {audioBlocked && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse"
          onClick={test}
          title="Your browser is blocking notification sounds — tap once to enable"
        >
          <BellRing className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Enable sound</span>}
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="touch-target hidden sm:inline-flex"
        onClick={test}
        title="Test notification sound"
      >
        <Play className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="touch-target"
        onClick={toggleMute}
        title={muted ? "Sound muted — notifications are silent" : "Mute notifications"}
      >
        {muted ? <VolumeX className="h-5 w-5 text-destructive" /> : <Volume2 className="h-5 w-5" />}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs capitalize hidden sm:inline-flex" title="Chime volume">
            {volume}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-56 p-2">
          <p className="px-2 pb-2 text-xs text-muted-foreground">Chime volume (this device)</p>
          <div className="flex flex-col">
            {LEVELS.map((level) => (
              <Button
                key={level.value}
                variant={volume === level.value ? "secondary" : "ghost"}
                size="sm"
                className="justify-start h-auto py-2"
                onClick={async () => {
                  setChimeVolume(level.value);
                  setVolume(level.value);
                  await unlockChimeAudio();
                  const result = await playNotificationChime();
                  setAudioBlocked(isAudioBlocked());
                  if (result !== "played") reportResult(result);
                }}
              >
                <span className="flex flex-col items-start">
                  <span className="text-sm">{level.label}</span>
                  <span className="text-xs text-muted-foreground">{level.hint}</span>
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="touch-target hidden sm:inline-flex" title="Choose notification sound">
            <Music className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            Tap a sound to hear it — your pick is saved for this device.
          </p>
          <div className="flex flex-col">
            {CHIME_SOUNDS.map((option) => (
              <Button
                key={option.value}
                variant={sound === option.value ? "secondary" : "ghost"}
                size="sm"
                className="justify-between h-auto py-2"
                onClick={async () => {
                  setChimeSound(option.value);
                  setSound(option.value);
                  await unlockChimeAudio();
                  const result = await playNotificationChime(option.value);
                  setAudioBlocked(isAudioBlocked());
                  if (result !== "played") reportResult(result);
                }}
              >
                <span className="flex flex-col items-start text-left">
                  <span className="text-sm">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </span>
                <Play className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

    </div>
  );
}
