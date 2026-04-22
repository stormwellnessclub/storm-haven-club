import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfYear, subMonths } from "date-fns";
import { Calendar as CalendarIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  type ReportDefinition, 
  DATE_RANGE_PRESETS,
  type DateRangePreset 
} from "@/lib/reportDefinitions";

interface ReportBuilderProps {
  report: ReportDefinition;
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  onFilterChange: (filterId: string, value: string | boolean) => void;
  onExport: () => void;
  isExporting?: boolean;
}

export function ReportBuilder({
  report,
  dateRange,
  filters,
  onDateRangeChange,
  onFilterChange,
  onExport,
  isExporting,
}: ReportBuilderProps) {
  const [datePreset, setDatePreset] = useState<DateRangePreset>(report.defaultDateRange);

  const handlePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset);
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (preset) {
      case 'today':
        start = startOfDay(today);
        end = endOfDay(today);
        break;
      case 'yesterday':
        start = startOfDay(subMonths(today, 0));
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
        end = new Date(endOfDay(start));
        break;
      case 'last7days':
        start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
        end = endOfDay(today);
        break;
      case 'last30days':
        start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30));
        end = endOfDay(today);
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        start = startOfMonth(subMonths(today, 1));
        end = endOfMonth(subMonths(today, 1));
        break;
      case 'last3months':
      case 'thisQuarter':
        start = startOfDay(subMonths(today, 3));
        end = endOfDay(today);
        break;
      case 'last12months':
      case 'thisYear':
        start = startOfYear(today);
        end = endOfDay(today);
        break;
      default:
        return;
    }

    onDateRangeChange({ start, end });
  };

  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Preset */}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Period:</Label>
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {datePreset === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.start, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.start}
                  onSelect={(date) => date && onDateRangeChange({ ...dateRange, start: date })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.end, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.end}
                  onSelect={(date) => date && onDateRangeChange({ ...dateRange, end: date })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </>
        )}

        {report.filters.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-8" />
            
            {/* Dynamic Filters */}
            {report.filters.map((filter) => (
              <div key={filter.id} className="flex items-center gap-2">
                {filter.type === 'select' && filter.options && (
                  <>
                    <Label className="text-sm text-muted-foreground">{filter.label}:</Label>
                    <Select 
                      value={(filters[filter.id] as string) || filter.options[0]?.value}
                      onValueChange={(value) => onFilterChange(filter.id, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                {filter.type === 'boolean' && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={filter.id}
                      checked={(filters[filter.id] as boolean) || false}
                      onCheckedChange={(checked) => onFilterChange(filter.id, checked)}
                    />
                    <Label htmlFor={filter.id} className="text-sm">
                      {filter.label}
                    </Label>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Export Button */}
        <div className="ml-auto">
          <Button onClick={onExport} disabled={isExporting} size="sm">
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>
    </div>
  );
}
