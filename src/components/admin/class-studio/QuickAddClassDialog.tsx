import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { STUDIOS, minutesToTime, timeToMinutes } from "@/lib/studios";

export interface QuickAddSeed {
  date: string;
  room: string;
  startMinutes: number;
}

interface Props {
  seed: QuickAddSeed | null;
  classTypes: any[];
  instructors: any[];
  pending: boolean;
  onClose: () => void;
  onCreate: (payload: {
    class_type_id: string;
    instructor_id: string | null;
    session_date: string;
    start_time: string;
    end_time: string;
    room: string;
    max_capacity: number;
    is_hidden: boolean;
  }) => void;
}

export function QuickAddClassDialog({ seed, classTypes, instructors, pending, onClose, onCreate }: Props) {
  const [classTypeId, setClassTypeId] = useState("");
  const [instructorId, setInstructorId] = useState("none");
  const [room, setRoom] = useState(STUDIOS[0] as string);
  const [start, setStart] = useState("06:00");
  const [duration, setDuration] = useState(50);
  const [capacity, setCapacity] = useState(8);
  const [publishNow, setPublishNow] = useState(false);

  useEffect(() => {
    if (!seed) return;
    setRoom(seed.room);
    setStart(minutesToTime(seed.startMinutes).slice(0, 5));
  }, [seed]);

  useEffect(() => {
    const ct = classTypes.find((c) => c.id === classTypeId);
    if (ct) {
      if (ct.duration_minutes) setDuration(ct.duration_minutes);
      if (ct.max_capacity) setCapacity(ct.max_capacity);
    }
  }, [classTypeId, classTypes]);

  if (!seed) return null;

  const submit = () => {
    const startMins = timeToMinutes(`${start}:00`);
    onCreate({
      class_type_id: classTypeId,
      instructor_id: instructorId === "none" ? null : instructorId,
      session_date: seed.date,
      start_time: minutesToTime(startMins),
      end_time: minutesToTime(startMins + duration),
      room,
      max_capacity: capacity,
      is_hidden: !publishNow,
    });
  };

  return (
    <Dialog open={!!seed} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a class — {seed.date}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Class type</Label>
            <Select value={classTypeId} onValueChange={setClassTypeId}>
              <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>
                {classTypes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Instructor</Label>
            <Select value={instructorId} onValueChange={setInstructorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unstaffed</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Studio</Label>
              <Select value={room} onValueChange={setRoom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDIOS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" min={10} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "50", 10))} />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value || "8", 10))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={publishNow} onCheckedChange={setPublishNow} />
            Publish immediately (otherwise saved as a draft)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!classTypeId || pending} onClick={submit}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
