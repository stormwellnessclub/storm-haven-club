import { cn } from "@/lib/utils";
import { 
  REPORT_CATEGORIES, 
  getReportsByCategory, 
  type ReportCategory,
  type ReportDefinition 
} from "@/lib/reportDefinitions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface ReportSidebarProps {
  selectedCategory: ReportCategory;
  selectedReport: string | null;
  onCategoryChange: (category: ReportCategory) => void;
  onReportSelect: (reportId: string) => void;
}

export function ReportSidebar({
  selectedCategory,
  selectedReport,
  onCategoryChange,
  onReportSelect,
}: ReportSidebarProps) {
  const reports = getReportsByCategory(selectedCategory);

  return (
    <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
      {/* Categories */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Categories
        </h3>
        <div className="space-y-1">
          {REPORT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <Button
                key={category.id}
                variant={isSelected ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-2",
                  isSelected && "bg-accent"
                )}
                onClick={() => onCategoryChange(category.id)}
              >
                <Icon className="h-4 w-4" />
                {category.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Reports in Category */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Reports
          </h3>
          <div className="space-y-1">
            {reports.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;
              return (
                <Button
                  key={report.id}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-between text-left h-auto py-2",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => onReportSelect(report.id)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{report.name}</span>
                  </div>
                  {isSelected && <ChevronRight className="h-4 w-4" />}
                </Button>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
