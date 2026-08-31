import { useState, useCallback, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ReportSidebar } from "@/components/admin/reports/ReportSidebar";
import { ReportBuilder } from "@/components/admin/reports/ReportBuilder";
import { ReportPreview } from "@/components/admin/reports/ReportPreview";
import { getReportById, getReportsByCategory, type ReportCategory, type DateRangePreset } from "@/lib/reportDefinitions";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, startOfYear, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

function getDateRangeFromPreset(preset: DateRangePreset): { start: Date; end: Date } {
  const now = new Date();
  
  switch (preset) {
    case 'thisMonth':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'last7days':
      return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case 'last30days':
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case 'last3months':
    case 'thisQuarter':
      return { start: startOfDay(subMonths(now, 3)), end: endOfDay(now) };
    case 'last12months':
    case 'thisYear':
      return { start: startOfYear(now), end: endOfDay(now) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function Reports() {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('financial');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [filters, setFilters] = useState<Record<string, string | boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const selectedReport = selectedReportId ? getReportById(selectedReportId) || null : null;

  useEffect(() => {
    if (!selectedReportId || selectedReport) {
      return;
    }

    const fallbackReport = getReportsByCategory(selectedCategory)[0] ?? null;
    setSelectedReportId(fallbackReport?.id ?? null);

    if (fallbackReport) {
      setDateRange(getDateRangeFromPreset(fallbackReport.defaultDateRange));
      setFilters({});
    }
  }, [selectedCategory, selectedReportId, selectedReport]);

  const handleCategoryChange = useCallback((category: ReportCategory) => {
    setSelectedCategory(category);
    setSelectedReportId(null);
    setFilters({});
  }, []);

  const handleReportSelect = useCallback((reportId: string) => {
    const report = getReportById(reportId);
    if (report) {
      setSelectedReportId(reportId);
      setDateRange(getDateRangeFromPreset(report.defaultDateRange));
      setFilters({});
      setMobileMenuOpen(false);
    }
  }, []);

  const handleDateRangeChange = useCallback((range: { start: Date; end: Date }) => {
    setDateRange(range);
  }, []);

  const handleFilterChange = useCallback((filterId: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [filterId]: value }));
  }, []);

  const handleExport = useCallback(() => {
    toast.info('Use the "Export" button inside the report below to download its full detail.');
  }, []);

  const SidebarContent = (
    <ReportSidebar
      selectedCategory={selectedCategory}
      selectedReport={selectedReportId}
      onCategoryChange={handleCategoryChange}
      onReportSelect={handleReportSelect}
    />
  );

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          {SidebarContent}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center gap-2 p-4 border-b">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                {SidebarContent}
              </SheetContent>
            </Sheet>
            <h1 className="font-semibold">
              {selectedReport?.name || 'Report Center'}
            </h1>
          </div>

          {/* Report Builder (filters & date range) */}
          {selectedReport && (
            <ReportBuilder
              report={selectedReport}
              dateRange={dateRange}
              filters={filters}
              onDateRangeChange={handleDateRangeChange}
              onFilterChange={handleFilterChange}
              onExport={handleExport}
              isExporting={isExporting}
            />
          )}

          {/* Report Preview */}
          <ReportPreview
            report={selectedReport}
            dateRange={dateRange}
            filters={filters}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
