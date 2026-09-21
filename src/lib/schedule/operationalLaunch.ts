import type { CafeSale } from '@/lib/cafeSales';
import type {
  LaunchOperationsData,
  LaunchSession,
  LaunchSpaAppointment,
} from '@/hooks/useLaunchOperations';

export interface FounderRole {
  name: string;
  hours: number;
}

export const DEFAULT_FOUNDER_ROLES: FounderRole[] = [
  { name: 'Floor coverage', hours: 40 },
  { name: 'Teaching & training', hours: 12 },
  { name: 'Phone, email & member care', hours: 12 },
  { name: 'Cleaning & maintenance', hours: 10 },
  { name: 'Hiring & onboarding', hours: 8 },
  { name: 'Ordering & setup', hours: 8 },
  { name: 'IT & systems', hours: 7 },
  { name: 'Marketing', hours: 5 },
  { name: 'Administration', hours: 10 },
];

export interface LaunchScenario {
  key: 'conservative' | 'evidence' | 'capacity';
  name: string;
  cafeMonthly: number;
  spaMonthly: number;
  combinedMonthly: number;
  note: string;
}

export interface OperationalLaunchReport {
  period: { openingDate: string; throughDate: string; weekdays: number; months: number };
  classes: {
    goal: number;
    delivered: number;
    cancelled: number;
    goalPct: number;
    shortfall: number;
    offeredSpots: number;
    bookedSpots: number;
    fillPct: number;
    instructors: number;
    studios: number;
  };
  spa: {
    completed: number;
    cancelled: number;
    clients: number;
    returningClients: number;
    repeatAppointments: number;
    repeatClientPct: number;
    serviceRevenue: number;
    tipsExcluded: number;
    averageTicket: number;
    activeRooms: number;
    usedRooms: number;
    activeTherapists: number;
    usedTherapists: number;
  };
  cafe: {
    revenue: number;
    transactions: number;
    purchasingMembers: number;
    repeatMembers: number;
    averageTicket: number;
    ordersPerBuyer: number;
    manualChargeRevenue: number;
    orderOnlyRevenue: number;
  };
  monthly: Array<{
    month: string;
    label: string;
    classGoal: number;
    classes: number;
    classPct: number;
    spaRevenue: number;
    spaAppointments: number;
    cafeRevenue: number;
    cafeTransactions: number;
  }>;
  scenarios: LaunchScenario[];
}

const round = (n: number, places = 0) => {
  const p = 10 ** places;
  return Math.round(n * p) / p;
};

function localDay(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function weekdaysBetween(start: Date, end: Date) {
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function sum<T>(rows: T[], getter: (row: T) => number) {
  return rows.reduce((total, row) => total + getter(row), 0);
}

function unique<T>(values: T[]) {
  return new Set(values.filter(Boolean)).size;
}

function monthlyPeak(rows: Array<{ month: string; value: number }>) {
  return Math.max(0, ...rows.map((r) => r.value));
}

export function buildOperationalLaunchReport(
  data: LaunchOperationsData,
  openingDate: string,
  throughDate: string
): OperationalLaunchReport {
  const start = localDay(openingDate);
  const end = localDay(throughDate);
  const weekdays = weekdaysBetween(start, end);
  const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);

  const sessions = data.sessions.filter((s) => s.session_date >= openingDate && s.session_date <= throughDate);
  const delivered = sessions.filter((s) => !s.is_cancelled && !s.is_hidden && !s.is_fundraiser);
  const cancelled = sessions.filter((s) => s.is_cancelled);
  const classGoal = weekdays * 20;
  const offeredSpots = sum(delivered, (s) => s.max_capacity || 0);
  const bookedSpots = sum(delivered, (s) => s.current_enrollment || 0);

  const spaRows = data.spaAppointments.filter((a) => a.appointment_date >= openingDate && a.appointment_date <= throughDate);
  const completed = spaRows.filter((a) => a.status === 'completed');
  const memberVisits = new Map<string, number>();
  completed.forEach((a) => {
    if (a.member_id) memberVisits.set(a.member_id, (memberVisits.get(a.member_id) ?? 0) + 1);
  });
  const returningClients = [...memberVisits.values()].filter((count) => count > 1).length;
  const repeatAppointments = [...memberVisits.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  const serviceRevenue = sum(completed, (a) => Number(a.amount_paid ?? 0) + Number(a.addons_total ?? 0));

  const cafeSales = data.cafeSales.filter((sale) => sale.created_at.slice(0, 10) >= openingDate && sale.created_at.slice(0, 10) <= throughDate);
  const buyerCounts = new Map<string, number>();
  cafeSales.forEach((sale) => {
    if (sale.memberId) buyerCounts.set(sale.memberId, (buyerCounts.get(sale.memberId) ?? 0) + 1);
  });
  const cafeRevenue = sum(cafeSales, (sale) => sale.total_amount);

  const monthRows: OperationalLaunchReport['monthly'] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= lastMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const effectiveStart = monthStart < start ? start : monthStart;
    const effectiveEnd = monthEnd > end ? end : monthEnd;
    const goal = weekdaysBetween(effectiveStart, effectiveEnd) * 20;
    const monthClasses = delivered.filter((s) => monthKey(s.session_date) === key).length;
    const monthSpa = completed.filter((a) => monthKey(a.appointment_date) === key);
    const monthCafe = cafeSales.filter((s) => monthKey(s.created_at) === key);
    monthRows.push({
      month: key,
      label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      classGoal: goal,
      classes: monthClasses,
      classPct: goal ? round((monthClasses / goal) * 100) : 0,
      spaRevenue: round(sum(monthSpa, (a) => Number(a.amount_paid ?? 0) + Number(a.addons_total ?? 0))),
      spaAppointments: monthSpa.length,
      cafeRevenue: round(sum(monthCafe, (s) => s.total_amount)),
      cafeTransactions: monthCafe.length,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const cafePeak = monthlyPeak(monthRows.map((m) => ({ month: m.month, value: m.cafeRevenue })));
  const spaPeak = monthlyPeak(monthRows.map((m) => ({ month: m.month, value: m.spaRevenue })));
  const roomsUsed = unique(completed.map((a) => a.room_id));
  const roomScale = roomsUsed ? data.rooms.length / roomsUsed : 1;
  const scenarios: LaunchScenario[] = [
    {
      key: 'conservative',
      name: 'Conservative',
      cafeMonthly: round(cafePeak),
      spaMonthly: round(spaPeak),
      combinedMonthly: round(cafePeak + spaPeak),
      note: 'Storm’s own best achieved month, repeated consistently. No outside growth assumption.',
    },
    {
      key: 'evidence',
      name: 'Evidence-based ramp',
      cafeMonthly: round(cafePeak / 0.7),
      spaMonthly: round(spaPeak * Math.min(2, roomScale)),
      combinedMonthly: round(cafePeak / 0.7 + spaPeak * Math.min(2, roomScale)),
      note: 'Café peak treated as 70% of mature operation; spa capped at twice demonstrated output.',
    },
    {
      key: 'capacity',
      name: 'Intended capacity',
      cafeMonthly: round(cafePeak / 0.6),
      spaMonthly: round(spaPeak * roomScale),
      combinedMonthly: round(cafePeak / 0.6 + spaPeak * roomScale),
      note: 'Target view only: café at the upper ramp gap and spa scaled from rooms actually used to all active rooms.',
    },
  ];

  return {
    period: { openingDate, throughDate, weekdays, months },
    classes: {
      goal: classGoal,
      delivered: delivered.length,
      cancelled: cancelled.length,
      goalPct: classGoal ? round((delivered.length / classGoal) * 100, 1) : 0,
      shortfall: Math.max(0, classGoal - delivered.length),
      offeredSpots,
      bookedSpots,
      fillPct: offeredSpots ? round((bookedSpots / offeredSpots) * 100, 1) : 0,
      instructors: unique(delivered.map((s: LaunchSession) => s.instructor_id)),
      studios: unique(delivered.map((s: LaunchSession) => s.room)),
    },
    spa: {
      completed: completed.length,
      cancelled: spaRows.filter((a) => a.status === 'cancelled').length,
      clients: memberVisits.size,
      returningClients,
      repeatAppointments,
      repeatClientPct: memberVisits.size ? round((returningClients / memberVisits.size) * 100, 1) : 0,
      serviceRevenue: round(serviceRevenue, 2),
      tipsExcluded: round(sum(completed, (a: LaunchSpaAppointment) => Number(a.tip_amount ?? 0)), 2),
      averageTicket: completed.length ? round(serviceRevenue / completed.length, 2) : 0,
      activeRooms: data.rooms.length,
      usedRooms: roomsUsed,
      activeTherapists: data.therapists.length,
      usedTherapists: unique(completed.map((a) => a.staff_id)),
    },
    cafe: {
      revenue: round(cafeRevenue, 2),
      transactions: cafeSales.length,
      purchasingMembers: buyerCounts.size,
      repeatMembers: [...buyerCounts.values()].filter((count) => count > 1).length,
      averageTicket: cafeSales.length ? round(cafeRevenue / cafeSales.length, 2) : 0,
      ordersPerBuyer: buyerCounts.size ? round(cafeSales.length / buyerCounts.size, 1) : 0,
      manualChargeRevenue: round(sum(cafeSales.filter((s: CafeSale) => s.source === 'manual_charges'), (s) => s.total_amount), 2),
      orderOnlyRevenue: round(sum(cafeSales.filter((s: CafeSale) => s.source === 'cafe_orders'), (s) => s.total_amount), 2),
    },
    monthly: monthRows,
    scenarios,
  };
}