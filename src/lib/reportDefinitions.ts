import {
  Receipt,
  DollarSign, 
  Users, 
  Clock, 
  Dumbbell, 
  Ticket, 
  Trophy,
  TrendingUp,
  CreditCard,
  BarChart3,
  PieChart,
  Activity,
  UserCheck,
  Calendar,
  Snowflake,
  Calculator,
  Coffee,
} from "lucide-react";

export type ReportCategory = 
  | 'financial'
  | 'membership'
  | 'attendance'
  | 'classes'
  | 'services'
  | 'engagement';

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  icon: React.ElementType;
  filters: ReportFilter[];
  defaultDateRange: DateRangePreset;
}

export interface ReportFilter {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'boolean';
  options?: { value: string; label: string }[];
}

export type DateRangePreset = 
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3months'
  | 'last12months'
  | 'thisQuarter'
  | 'thisYear'
  | 'custom';

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last3months', label: 'Last 3 Months' },
  { value: 'last12months', label: 'Last 12 Months' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export const REPORT_CATEGORIES: { id: ReportCategory; label: string; icon: React.ElementType }[] = [
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'membership', label: 'Membership', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'classes', label: 'Classes', icon: Dumbbell },
  { id: 'services', label: 'Services', icon: Ticket },
  { id: 'engagement', label: 'Engagement', icon: Trophy },
];

const TIER_OPTIONS = [
  { value: 'all', label: 'All Tiers' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
];

const CHARGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Charges' },
  { value: 'membership_dues', label: 'Membership Dues' },
  { value: 'annual_fee', label: 'Annual Fee' },
  { value: 'class_pass', label: 'Class Pass' },
  { value: 'guest_pass', label: 'Guest Pass' },
  { value: 'pos_other', label: 'POS' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending_activation', label: 'Pending Activation' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'past_due', label: 'Past Due' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Successful' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

const CARD_SETUP_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'initiated', label: 'In Progress' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed/Declined' },
  { value: 'abandoned', label: 'Abandoned' },
];

export const REPORTS: ReportDefinition[] = [
  // Financial Reports
  {
    id: 'daily-sales-breakdown',
    name: 'Daily Sales Breakdown',
    description: 'Item-level sales detail across Café, Merch, Classes, Guest Passes & Memberships',
    category: 'financial',
    icon: BarChart3,
    filters: [],
    defaultDateRange: 'today',
  },
  {
    id: 'daily-revenue',
    name: 'Daily Revenue Breakdown',
    description: 'Revenue per day broken down by area: Café, Spa, Classes, Guest Passes, Memberships',
    category: 'financial',
    icon: BarChart3,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'sales-segmentation',
    name: 'Sales Segmentation',
    description: 'Detailed revenue breakdown by all sources: memberships, café, spa, classes, guest passes',
    category: 'financial',
    icon: PieChart,
    filters: [],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'autopay-upcoming-charges',
    name: 'Autopay / Upcoming Charges',
    description: 'Scheduled member dues and annual fee renewals from saved next billing dates',
    category: 'financial',
    icon: Calendar,
    filters: [
      { id: 'chargeType', label: 'Charge Type', type: 'select', options: CHARGE_TYPE_OPTIONS },
      { id: 'tier', label: 'Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'failed-payments',
    name: 'Failed Payments',
    description: 'Unresolved failed payment attempts with retry and resolution actions',
    category: 'financial',
    icon: CreditCard,
    filters: [
      { id: 'chargeType', label: 'Charge Type', type: 'select', options: CHARGE_TYPE_OPTIONS },
      { id: 'tier', label: 'Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisQuarter',
  },
  {
    id: 'collected-revenue',
    name: 'Collected Revenue',
    description: 'Successful payment attempts grouped into dues, annual fee, class pass, guest pass, and POS',
    category: 'financial',
    icon: Receipt,
    filters: [
      { id: 'chargeType', label: 'Charge Type', type: 'select', options: CHARGE_TYPE_OPTIONS },
      { id: 'tier', label: 'Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'projected-revenue',
    name: 'Projected Revenue',
    description: 'Projected member billing using next dues and annual fee dates plus pricing rules',
    category: 'financial',
    icon: TrendingUp,
    filters: [
      { id: 'chargeType', label: 'Charge Type', type: 'select', options: CHARGE_TYPE_OPTIONS },
      { id: 'tier', label: 'Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisYear',
  },
  {
    id: 'revenue-summary-dashboard',
    name: 'Revenue Summary Dashboard',
    description: 'Side-by-side collected vs projected revenue with MRR and 12-month totals',
    category: 'financial',
    icon: DollarSign,
    filters: [
      { id: 'chargeType', label: 'Charge Type', type: 'select', options: CHARGE_TYPE_OPTIONS },
      { id: 'tier', label: 'Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisYear',
  },
  {
    id: 'revenue-by-category',
    name: 'Revenue by Category',
    description: 'Revenue breakdown: Memberships, Classes, Spa, Cafe, Guest Passes',
    category: 'financial',
    icon: PieChart,
    filters: [],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'payment-analysis',
    name: 'Payment Analysis',
    description: 'Success rates, decline reasons, and retry performance',
    category: 'financial',
    icon: CreditCard,
    filters: [
      { id: 'status', label: 'Payment Status', type: 'select', options: PAYMENT_STATUS_OPTIONS },
    ],
    defaultDateRange: 'last30days',
  },
  {
    id: 'payment-follow-up',
    name: 'Payment Follow-Up',
    description: 'Card setup attempts: who clicked but failed, declines vs abandonments',
    category: 'financial',
    icon: CreditCard,
    filters: [
      { id: 'status', label: 'Attempt Status', type: 'select', options: CARD_SETUP_STATUS_OPTIONS },
    ],
    defaultDateRange: 'last30days',
  },
  {
    id: 'class-revenue-projection',
    name: 'Class Revenue Projection',
    description: 'Projected class revenue with adjustable fill rates and member mix',
    category: 'financial',
    icon: Calculator,
    filters: [],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'sales-tax-collected',
    name: 'Sales Tax Collected',
    description: 'MI 6% sales tax collected from Café, Storm Shop, and POS transactions',
    category: 'financial',
    icon: Receipt,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'cafe-sales',
    name: 'Café Sales Report',
    description: 'Daily café revenue, top items, category breakdown, tax collected, and order log',
    category: 'financial',
    icon: Coffee,
    filters: [],
    defaultDateRange: 'today',
  },
  {
    id: 'cafe-sales-by-month',
    name: 'Cafe Sales by Month',
    description: 'Monthly café gross sales, estimated 6% MI sales tax, and net sales',
    category: 'financial',
    icon: Coffee,
    filters: [],
    defaultDateRange: 'last12months',
  },
  
  {
    id: 'member-status-distribution',
    name: 'Member Status Distribution',
    description: 'Active, Frozen, Cancelled, Pending members',
    category: 'membership',
    icon: Users,
    filters: [
      { id: 'tier', label: 'Membership Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'tier-distribution',
    name: 'Tier Distribution',
    description: 'Members per tier with revenue contribution',
    category: 'membership',
    icon: BarChart3,
    filters: [
      { id: 'status', label: 'Member Status', type: 'select', options: STATUS_OPTIONS },
    ],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'founding-members',
    name: 'Founding Members Report',
    description: 'Founding vs regular member breakdown and value',
    category: 'membership',
    icon: Trophy,
    filters: [],
    defaultDateRange: 'thisYear',
  },
  {
    id: 'new-applications',
    name: 'New Applications',
    description: 'Applications received by date with status',
    category: 'membership',
    icon: UserCheck,
    filters: [
      { id: 'status', label: 'Application Status', type: 'select', options: STATUS_OPTIONS },
      { id: 'tier', label: 'Membership Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'last30days',
  },
  {
    id: 'freeze-history',
    name: 'Freeze History',
    description: 'All membership freeze requests and status',
    category: 'membership',
    icon: Snowflake,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'charges-during-freeze',
    name: 'Charges During Freeze',
    description: 'Payments taken while a member was frozen — refund review list (PDF export)',
    category: 'membership',
    icon: Snowflake,
    filters: [],
    defaultDateRange: 'last12months',
  },

  
  // Attendance Reports
  {
    id: 'daily-checkins',
    name: 'Daily Check-ins',
    description: 'Check-in count by date and time',
    category: 'attendance',
    icon: Clock,
    filters: [],
    defaultDateRange: 'last7days',
  },
  {
    id: 'peak-hours',
    name: 'Peak Hours Analysis',
    description: 'Busiest times heatmap by day and hour',
    category: 'attendance',
    icon: Activity,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'visit-frequency',
    name: 'Visit Frequency',
    description: 'Average visits per member by tier',
    category: 'attendance',
    icon: BarChart3,
    filters: [
      { id: 'tier', label: 'Membership Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'last30days',
  },
  {
    id: 'member-attendance-overview',
    name: 'Member Attendance Overview',
    description: 'Lifetime check-ins, avg duration, and per-member trends',
    category: 'attendance',
    icon: Users,
    filters: [
      { id: 'tier', label: 'Membership Tier', type: 'select', options: TIER_OPTIONS },
      { id: 'status', label: 'Member Status', type: 'select', options: STATUS_OPTIONS },
    ],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'visit-duration-analysis',
    name: 'Visit Duration Analysis',
    description: 'Avg duration by tier, day of week, and distribution',
    category: 'attendance',
    icon: Clock,
    filters: [],
    defaultDateRange: 'last30days',
  },
  
  // Class Reports
  {
    id: 'class-attendance',
    name: 'Class Attendance',
    description: 'Bookings and attendance by class type',
    category: 'classes',
    icon: Dumbbell,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'class-utilization',
    name: 'Class Utilization',
    description: 'Capacity vs actual attendance rates',
    category: 'classes',
    icon: PieChart,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'instructor-sessions',
    name: 'Instructor Sessions',
    description: 'Classes actually taught (attended only), with export',
    category: 'classes',
    icon: UserCheck,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'instructor-performance',
    name: 'Instructor Performance',
    description: 'Sessions taught and average attendance',
    category: 'classes',
    icon: UserCheck,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'no-show-report',
    name: 'No-Show Report',
    description: 'Missed bookings and cancellations',
    category: 'classes',
    icon: Calendar,
    filters: [],
    defaultDateRange: 'last30days',
  },
  
  // Services Reports
  {
    id: 'guest-pass-usage',
    name: 'Guest Pass Usage',
    description: 'Passes issued, used, expired — with revenue tracking and trends',
    category: 'services',
    icon: Ticket,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'class-pass-sales',
    name: 'Class Pass Sales',
    description: 'Class pass volume, revenue by category, member vs non-member split',
    category: 'services',
    icon: Dumbbell,
    filters: [],
    defaultDateRange: 'last30days',
  },
  
  // Engagement Reports
  {
    id: 'credit-balances',
    name: 'Credit Balances',
    description: 'Member credit standings and usage',
    category: 'engagement',
    icon: CreditCard,
    filters: [
      { id: 'tier', label: 'Membership Tier', type: 'select', options: TIER_OPTIONS },
    ],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'workout-activity',
    name: 'Workout Activity',
    description: 'Logged workouts by member',
    category: 'engagement',
    icon: Activity,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'goals-progress',
    name: 'Goals Progress',
    description: 'Active goals and completion rates',
    category: 'engagement',
    icon: Trophy,
    filters: [],
    defaultDateRange: 'thisMonth',
  },
  {
    id: 'member-engagement',
    name: 'Member Engagement',
    description: 'Holistic engagement scores across all touchpoints with churn risk identification',
    category: 'engagement',
    icon: Activity,
    filters: [],
    defaultDateRange: 'last30days',
  },
  {
    id: 'guest-returns',
    name: 'Guest Returns',
    description: 'Repeat guest tracking by email with return rates and conversion status',
    category: 'services',
    icon: UserCheck,
    filters: [],
    defaultDateRange: 'thisYear',
  },
  {
    id: 'class-engagement',
    name: 'Class Engagement',
    description: 'Member-centric class participation patterns and weekly trends',
    category: 'classes',
    icon: Dumbbell,
    filters: [],
    defaultDateRange: 'last30days',
  },
];

export function getReportsByCategory(category: ReportCategory): ReportDefinition[] {
  return REPORTS.filter(r => r.category === category);
}

export function getReportById(id: string): ReportDefinition | undefined {
  return REPORTS.find(r => r.id === id);
}
