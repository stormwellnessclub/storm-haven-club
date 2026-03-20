import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquarePlus, Clock, Megaphone } from "lucide-react";
import { useMyHourRequests, useSubmitHourRequest } from "@/hooks/useKidsCareHourRequests";
import { formatTime12h } from "@/lib/timeFormat";
import { format, parseISO } from "date-fns";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00",
];

export function HourRequestForm() {
  const { data: myRequests, isLoading: loadingRequests } = useMyHourRequests();
  const submitRequest = useSubmitHourRequest();

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = () => {
    if (selectedDays.length === 0 || !startTime || !endTime) return;
    submitRequest.mutate(
      { preferred_days: selectedDays, preferred_start_time: startTime, preferred_end_time: endTime, notes },
      {
        onSuccess: () => {
          setSelectedDays([]);
          setStartTime("");
          setEndTime("");
          setNotes("");
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-primary border-primary/30">Request Sent</Badge>;
      case "reviewed": return <Badge variant="outline" className="text-primary border-primary/30">Reviewed</Badge>;
      case "accommodated": return <Badge variant="outline" className="text-success border-success/30">Accommodated</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Limited Launch Banner */}
      <Alert className="border-primary/30 bg-primary/5">
        <Megaphone className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Limited Launch Hours</strong> — Kids Care is now open with limited hours as we launch! As more families sign up, we'll continue to expand our schedule. Stay tuned for more availability!
        </AlertDescription>
      </Alert>

      {/* Request Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Request the Hours You Need
          </CardTitle>
          <CardDescription>
            We're expanding Kids Care hours based on parent demand. Let us know the days and times that work best for your family, and we'll do our best to accommodate as we grow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Preferred Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedDays.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                  />
                  <span className="text-sm">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Time</label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Start time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{formatTime12h(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="End time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{formatTime12h(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Additional Notes (optional)</label>
            <Textarea
              placeholder="Any details about your scheduling needs..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={selectedDays.length === 0 || !startTime || !endTime || submitRequest.isPending}
          >
            {submitRequest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit Request
          </Button>
        </CardContent>
      </Card>

      {/* Previous Requests */}
      {loadingRequests ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : myRequests && myRequests.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Your Previous Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myRequests.map((req) => (
              <div key={req.id} className="flex items-start justify-between border-b last:border-0 pb-3 last:pb-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1">
                    {req.preferred_days.map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime12h(req.preferred_start_time)} – {formatTime12h(req.preferred_end_time)}
                  </p>
                  {req.notes && <p className="text-xs text-muted-foreground">{req.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    Submitted {format(parseISO(req.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                {getStatusBadge(req.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
