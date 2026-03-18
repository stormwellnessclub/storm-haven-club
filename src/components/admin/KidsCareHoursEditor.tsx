import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Copy, Save } from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek } from "date-fns";
import {
  useKidsCareHoursForWeek,
  useSaveKidsCareHours,
  KidsCareHourEntry,
  getMonday,
} from "@/hooks/useKidsCareHours";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_OPEN = "08:00";
const DEFAULT_CLOSE = "17:00";

function buildEmptyWeek(weekStart: string): KidsCareHourEntry[] {
  return Array.from({ length: 7 }, (_, i) => ({
    week_start: weekStart,
    day_of_week: i,
    open_time: DEFAULT_OPEN,
    close_time: DEFAULT_CLOSE,
    is_closed: true,
    notes: null,
  }));
}

export function KidsCareHoursEditor() {
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const mondayStr = getMonday(currentWeekDate);

  const { data: savedHours, isLoading } = useKidsCareHoursForWeek(currentWeekDate);
  const saveHours = useSaveKidsCareHours();

  const prevWeekDate = subWeeks(currentWeekDate, 1);
  const { data: prevWeekHours } = useKidsCareHoursForWeek(prevWeekDate);

  const [localHours, setLocalHours] = useState<KidsCareHourEntry[]>(() => buildEmptyWeek(mondayStr));

  // Sync from saved data
  useEffect(() => {
    if (savedHours && savedHours.length > 0) {
      const merged = buildEmptyWeek(mondayStr).map((empty) => {
        const saved = savedHours.find((s) => s.day_of_week === empty.day_of_week);
        return saved ? { ...empty, ...saved, week_start: mondayStr } : empty;
      });
      setLocalHours(merged);
    } else {
      setLocalHours(buildEmptyWeek(mondayStr));
    }
  }, [savedHours, mondayStr]);

  const updateDay = (dayIndex: number, updates: Partial<KidsCareHourEntry>) => {
    setLocalHours((prev) =>
      prev.map((h) => (h.day_of_week === dayIndex ? { ...h, ...updates } : h))
    );
  };

  const handleSave = () => {
    saveHours.mutate(localHours);
  };

  const handleCopyPrevious = () => {
    if (!prevWeekHours || prevWeekHours.length === 0) return;
    const copied = buildEmptyWeek(mondayStr).map((empty) => {
      const prev = prevWeekHours.find((p) => p.day_of_week === empty.day_of_week);
      return prev
        ? { ...empty, open_time: prev.open_time, close_time: prev.close_time, is_closed: prev.is_closed, notes: prev.notes }
        : empty;
    });
    setLocalHours(copied);
  };

  const weekLabel = format(startOfWeek(currentWeekDate, { weekStartsOn: 1 }), "MMM d, yyyy");
  const hasHoursSet = savedHours && savedHours.length > 0;
  const hasPrevWeek = prevWeekHours && prevWeekHours.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weekly Hours</CardTitle>
            <CardDescription>Set Kids Care operating hours for each week</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!hasHoursSet && (
              <Badge variant="outline" className="text-xs">No hours set</Badge>
            )}
            {hasHoursSet && (
              <Badge className="bg-success/10 text-success border-success/30 text-xs">Published</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Week Navigator */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekDate(subWeeks(currentWeekDate, 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="font-medium text-sm">Week of {weekLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeekDate(addWeeks(currentWeekDate, 1))}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Day Rows */}
            <div className="space-y-3">
              {localHours.map((entry) => (
                <div
                  key={entry.day_of_week}
                  className={`flex items-center gap-4 p-3 rounded-sm border ${
                    entry.is_closed ? "bg-muted/50 border-border" : "bg-background border-accent/20"
                  }`}
                >
                  <div className="w-28 font-medium text-sm">{DAY_NAMES[entry.day_of_week]}</div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!entry.is_closed}
                      onCheckedChange={(open) => updateDay(entry.day_of_week, { is_closed: !open })}
                    />
                    <span className="text-xs text-muted-foreground">{entry.is_closed ? "Closed" : "Open"}</span>
                  </div>

                  {!entry.is_closed && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs sr-only">Open</Label>
                        <Input
                          type="time"
                          className="w-32 h-8 text-sm"
                          value={entry.open_time?.slice(0, 5) || DEFAULT_OPEN}
                          onChange={(e) => updateDay(entry.day_of_week, { open_time: e.target.value + ":00" })}
                        />
                        <span className="text-muted-foreground text-xs">to</span>
                        <Input
                          type="time"
                          className="w-32 h-8 text-sm"
                          value={entry.close_time?.slice(0, 5) || DEFAULT_CLOSE}
                          onChange={(e) => updateDay(entry.day_of_week, { close_time: e.target.value + ":00" })}
                        />
                      </div>
                      <Input
                        className="flex-1 h-8 text-xs"
                        placeholder="Notes (optional)"
                        value={entry.notes || ""}
                        onChange={(e) => updateDay(entry.day_of_week, { notes: e.target.value || null })}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saveHours.isPending}>
                {saveHours.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Hours
              </Button>
              {hasPrevWeek && (
                <Button variant="outline" onClick={handleCopyPrevious}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Previous Week
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
