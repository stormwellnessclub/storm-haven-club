import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileBarChart } from "lucide-react";
import { type ReportDefinition } from "@/lib/reportDefinitions";

// Report components
import { RevenueByCategoryReport } from "./reports/RevenueByCategoryReport";
import { ClassRevenueProjectionReport } from "./reports/ClassRevenueProjectionReport";
import { MemberStatusReport } from "./reports/MemberStatusReport";
import { TierDistributionReport } from "./reports/TierDistributionReport";
import { FoundingMembersReport } from "./reports/FoundingMembersReport";
import { NewApplicationsReport } from "./reports/NewApplicationsReport";
import { FreezeHistoryReport } from "./reports/FreezeHistoryReport";
import { PaymentAnalysisReport } from "./reports/PaymentAnalysisReport";
import { DailyCheckinsReport } from "./reports/DailyCheckinsReport";
import { PeakHoursReport } from "./reports/PeakHoursReport";
import { VisitFrequencyReport } from "./reports/VisitFrequencyReport";
import { MemberAttendanceOverviewReport } from "./reports/MemberAttendanceOverviewReport";
import { VisitDurationReport } from "./reports/VisitDurationReport";
import { ClassAttendanceReport } from "./reports/ClassAttendanceReport";
import { ClassUtilizationReport } from "./reports/ClassUtilizationReport";
import { InstructorPerformanceReport } from "./reports/InstructorPerformanceReport";
import { NoShowReport } from "./reports/NoShowReport";
import { GuestPassUsageReport } from "./reports/GuestPassUsageReport";
import { CreditBalancesReport } from "./reports/CreditBalancesReport";
import { WorkoutActivityReport } from "./reports/WorkoutActivityReport";
import { GoalsProgressReport } from "./reports/GoalsProgressReport";
import { PaymentFollowUpReport } from "./reports/PaymentFollowUpReport";
import { SalesSegmentationReport } from "./reports/SalesSegmentationReport";
import { DailyRevenueReport } from "./reports/DailyRevenueReport";
import { ClassPassSalesReport } from "./reports/ClassPassSalesReport";
import { MemberEngagementReport } from "./reports/MemberEngagementReport";
import { GuestReturnsReport } from "./reports/GuestReturnsReport";
import { ClassEngagementReport } from "./reports/ClassEngagementReport";
import { DailySalesBreakdownReport } from "./reports/DailySalesBreakdownReport";
import { SalesTaxReport } from "./reports/SalesTaxReport";
import { CafeSalesReport } from "./reports/CafeSalesReport";
import { CafeSalesByMonthReport } from "./reports/CafeSalesByMonthReport";
import { AutopayUpcomingChargesReport } from "./reports/AutopayUpcomingChargesReport";
import { FailedPaymentsReport } from "./reports/FailedPaymentsReport";
import { CollectedRevenueReport } from "./reports/CollectedRevenueReport";
import { ProjectedRevenueReport } from "./reports/ProjectedRevenueReport";
import { RevenueSummaryDashboardReport } from "./reports/RevenueSummaryDashboardReport";
interface ReportPreviewProps {
  report: ReportDefinition | null;
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
  isLoading?: boolean;
  error?: string | null;
}

export function ReportPreview({
  report,
  dateRange,
  filters,
  isLoading,
  error,
}: ReportPreviewProps) {
  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a report from the sidebar to get started</p>
        </div>
      </div>
    );
  }

  const Icon = report.icon;

  return (
    <div className="flex-1 overflow-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{report.name}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : (
            <ReportContent 
              reportId={report.id} 
              dateRange={dateRange} 
              filters={filters} 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ReportContentProps {
  reportId: string;
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

function ReportContent({ reportId, dateRange, filters }: ReportContentProps) {
  const reportComponents: Record<string, React.ComponentType<{ dateRange: { start: Date; end: Date }; filters: Record<string, string | boolean> }>> = {
    'daily-sales-breakdown': DailySalesBreakdownReport,
    'revenue-summary-dashboard': RevenueSummaryDashboardReport,
    'daily-revenue': DailyRevenueReport,
    'revenue-by-category': RevenueByCategoryReport,
    'sales-segmentation': SalesSegmentationReport,
    'autopay-upcoming-charges': AutopayUpcomingChargesReport,
    'failed-payments': FailedPaymentsReport,
    'collected-revenue': CollectedRevenueReport,
    'projected-revenue': ProjectedRevenueReport,
    'class-revenue-projection': ClassRevenueProjectionReport,
    'payment-analysis': PaymentAnalysisReport,
    'payment-follow-up': PaymentFollowUpReport,
    'member-status-distribution': MemberStatusReport,
    'tier-distribution': TierDistributionReport,
    'founding-members': FoundingMembersReport,
    'new-applications': NewApplicationsReport,
    'freeze-history': FreezeHistoryReport,
    'daily-checkins': DailyCheckinsReport,
    'peak-hours': PeakHoursReport,
    'visit-frequency': VisitFrequencyReport,
    'member-attendance-overview': MemberAttendanceOverviewReport,
    'visit-duration-analysis': VisitDurationReport,
    'class-attendance': ClassAttendanceReport,
    'class-utilization': ClassUtilizationReport,
    'instructor-performance': InstructorPerformanceReport,
    'no-show-report': NoShowReport,
    'guest-pass-usage': GuestPassUsageReport,
    'credit-balances': CreditBalancesReport,
    'class-pass-sales': ClassPassSalesReport,
    'workout-activity': WorkoutActivityReport,
    'goals-progress': GoalsProgressReport,
    'member-engagement': MemberEngagementReport,
    'guest-returns': GuestReturnsReport,
    'class-engagement': ClassEngagementReport,
    'sales-tax-collected': SalesTaxReport,
    'cafe-sales': CafeSalesReport,
    'cafe-sales-by-month': CafeSalesByMonthReport,
  };

  const ReportComponent = reportComponents[reportId];

  if (!ReportComponent) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>This report is coming soon</p>
        <p className="text-sm mt-2">Report ID: {reportId}</p>
      </div>
    );
  }

  return <ReportComponent dateRange={dateRange} filters={filters} />;
}
