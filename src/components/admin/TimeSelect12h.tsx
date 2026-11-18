import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime12h } from "@/lib/timeFormat";

/** "HH:mm" options every `step` minutes for a whole day. */
function buildOptions(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Time picker that always shows normal 12-hour times (9:00 AM, 4:30 PM),
 * no matter the phone or computer clock setting. Value stays "HH:mm".
 */
export function TimeSelect12h({
  value, onChange, step = 15, className, ariaLabel, placeholder = "Pick a time",
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const v = (value ?? "").slice(0, 5);
  const options = useMemo(() => {
    const base = buildOptions(step);
    return v && !base.includes(v) ? [...base, v].sort() : base;
  }, [step, v]);
  return (
    <Select value={v || undefined} onValueChange={onChange}>
      <SelectTrigger className={className ?? "h-9"} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((t) => (
          <SelectItem key={t} value={t}>{formatTime12h(t)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
