import { formatTime12h } from "@/lib/timeFormat";

export function formatSpaTime(time: string | null | undefined): string {
  return formatTime12h(time);
}

export function formatSpaTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatSpaTime(start)} – ${formatSpaTime(end)}`;
}