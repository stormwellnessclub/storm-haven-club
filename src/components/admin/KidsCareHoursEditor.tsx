import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Plus, Trash2, Save, Copy, UserRound } from "lucide-react";
import { format, getMonth, getYear } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useKidsCareHourSlotsStaff,
  useKidsCareHourSlotsForMonth,
  useSaveKidsCareHourSlots,
  useCopyKidsCareHourSlots,
} from "@/hooks/useKidsCareHours";
import { formatTime12h } from "@/lib/timeFormat";

interface LocalSlot {
  open_time: string;
  close_time: string;
  label: string;
  notes: string;
  staff_name: string;
}

const DEFAULT_SLOT: LocalSlot = { open_time: "09:00", close_time: "12:00", label: "", notes: "", staff_name: "" };

export function KidsCareHoursEditor() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: savedSlots, isLoading } = useKidsCareHourSlotsStaff(selectedDate);
  const { data: monthSlots } = useKidsCareHourSlotsForMonth(
    getYear(calendarMonth),
    getMonth(calendarMonth) + 1
  );
  const saveSlots = useSaveKidsCareHourSlots();
  const copySlots = useCopyKidsCareHourSlots();

  // Build set of dates with configured slots for dot indicators
  const datesWithSlots = new Set(
    (monthSlots || []).map((s) => s.slot_date)
  );

  // Local editing state
  const [localSlots, setLocalSlots] = useState<LocalSlot[]>([]);
  const [initialized, setInitialized] = useState<string>("");

  if (!isLoading && initialized !== dateStr) {
    if (savedSlots && savedSlots.length > 0) {
      setLocalSlots(
        savedSlots.map((s) => ({
          open_time: s.open_time.slice(0, 5),
          close_time: s.close_time.slice(0, 5),
          label: s.label || "",
          notes: s.notes || "",
          staff_name: s.staff_name || "",
        }))
      );
    } else {
      setLocalSlots([]);
    }
    setInitialized(dateStr);
  }

  const addSlot = () => setLocalSlots((prev) => [...prev, { ...DEFAULT_SLOT }]);
  const removeSlot = (index: number) => setLocalSlots((prev) => prev.filter((_, i) => i !== index));
  const updateSlot = (index: number, updates: Partial<LocalSlot>) =>
    setLocalSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));

  const handleSave = () => {
    saveSlots.mutate(
      {
        date: dateStr,
        slots: localSlots.map((s) => ({
          slot_date: dateStr,
          open_time: s.open_time + ":00",
          close_time: s.close_time + ":00",
          label: s.label || null,
          notes: s.notes || null,
          staff_name: s.staff_name || null,
        })),
      },
      { onSuccess: () => setInitialized("") }
    );
  };

  // Copy to dates state
  const [showCopy, setShowCopy] = useState(false);
  const [copyDates, setCopyDates] = useState<Date[]>([]);

  const handleCopyToSelectedDates = () => {
    if (copyDates.length === 0) return;
    copySlots.mutate(
      {
        sourceDate: dateStr,
        targetDates: copyDates.map((d) => format(d, "yyyy-MM-dd")),
      },
      { onSuccess: () => { setShowCopy(false); setCopyDates([]); setInitialized(""); } }
    );
  };

  const hasSlots = savedSlots && savedSlots.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Kids Care Hours</CardTitle>
            <CardDescription>Set operating hours for specific dates. Dates with hours show a dot indicator.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasSlots ? (
              <Badge className="bg-success/10 text-success border-success/30 text-xs">Published</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">No hours set</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calendar Overview */}
        <div className="space-y-2">
          <Label>Select Date</Label>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            className={cn("p-3 pointer-events-auto rounded-sm border")}
            modifiers={{
              hasSlots: (date) => datesWithSlots.has(format(date, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              hasSlots: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
            }}
          />
          <p className="text-xs text-muted-foreground">
            Selected: <strong>{format(selectedDate, "EEEE, MMMM d, yyyy")}</strong>
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Slot Rows */}
            {localSlots.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-sm">
                No time slots set — Kids Care will be <strong>closed</strong> on this date.
              </div>
            ) : (
              <div className="space-y-3">
                {localSlots.map((slot, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-3 p-3 rounded-sm border bg-background">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Open</Label>
                      <Input
                        type="time"
                        className="w-32 h-8 text-sm"
                        value={slot.open_time}
                        onChange={(e) => updateSlot(index, { open_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Close</Label>
                      <Input
                        type="time"
                        className="w-32 h-8 text-sm"
                        value={slot.close_time}
                        onChange={(e) => updateSlot(index, { close_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="e.g. Morning, Evening"
                        value={slot.label}
                        onChange={(e) => updateSlot(index, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserRound className="h-3 w-3" /> Staff
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Staff name (admin only)"
                        value={slot.staff_name}
                        onChange={(e) => updateSlot(index, { staff_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[120px]">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Optional notes"
                        value={slot.notes}
                        onChange={(e) => updateSlot(index, { notes: e.target.value })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeSlot(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={addSlot}>
                <Plus className="h-4 w-4 mr-1" /> Add Time Slot
              </Button>
              <Button onClick={handleSave} disabled={saveSlots.isPending} size="sm">
                {saveSlots.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Hours
              </Button>
              {hasSlots && (
                <Button variant="outline" size="sm" onClick={() => setShowCopy(!showCopy)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy to Dates
                </Button>
              )}
            </div>

            {/* Copy to dates panel */}
            {showCopy && (
              <div className="border rounded-sm p-4 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">
                  Copy <strong>{format(selectedDate, "MMM d")}</strong>'s slots to:
                </p>
                <Calendar
                  mode="multiple"
                  selected={copyDates}
                  onSelect={(dates) => setCopyDates(dates || [])}
                  disabled={(d) => format(d, "yyyy-MM-dd") === dateStr}
                  className={cn("p-3 pointer-events-auto")}
                />
                {copyDates.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {copyDates.map((d) => (
                      <Badge key={d.toISOString()} variant="secondary" className="text-xs">
                        {format(d, "MMM d")}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={copyDates.length === 0 || copySlots.isPending}
                    onClick={handleCopyToSelectedDates}
                  >
                    {copySlots.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Copy to {copyDates.length} date{copyDates.length !== 1 ? "s" : ""}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowCopy(false); setCopyDates([]); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Preview of saved slots */}
            {hasSlots && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Published hours for {format(selectedDate, "MMM d")}:</p>
                {savedSlots!.map((s, i) => (
                  <p key={i}>
                    {s.label ? `${s.label}: ` : ""}
                    {formatTime12h(s.open_time)} – {formatTime12h(s.close_time)}
                    {s.staff_name ? ` — Staff: ${s.staff_name}` : ""}
                    {s.notes ? ` (${s.notes})` : ""}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
