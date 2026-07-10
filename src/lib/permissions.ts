export type AppRole = 
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'front_desk'
  | 'spa_staff'
  | 'class_instructor'
  | 'cafe_staff'
  | 'childcare_staff';

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  front_desk: 'Front Desk',
  spa_staff: 'Spa Staff',
  class_instructor: 'Class Instructor',
  cafe_staff: 'Cafe Staff',
  childcare_staff: 'Childcare Staff',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full access to all features and settings',
  admin: 'Full access except super admin functions',
  manager: 'Dashboard, members, applications, appointments, payments (view)',
  front_desk: 'Check-in, members, appointments, payments, guest passes',
  spa_staff: 'Spa appointments only',
  class_instructor: 'Class schedule and attendance',
  cafe_staff: 'Cafe POS and member card charges',
  childcare_staff: 'Childcare check-in and roster',
};

// Define which roles can access which pages
// Patterns with :param segments match any value in that position
export const PAGE_PERMISSIONS: Record<string, AppRole[]> = {
  '/admin': ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff', 'class_instructor', 'cafe_staff', 'childcare_staff'],
  '/admin/dashboard': ['super_admin', 'admin', 'manager'],
  '/admin/check-in': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/check-in-history': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/scanner': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/members': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/members/:id': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/member-credits': ['super_admin', 'admin', 'manager'],
  '/admin/freeze-requests': ['super_admin', 'admin', 'manager'],
  '/admin/applications': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/appointments': ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff'],
  '/admin/payments': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/payment-tracking': ['super_admin', 'admin', 'manager'],
  '/admin/payment-reports': ['super_admin', 'admin', 'manager'],
  '/admin/billing-arrears': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/guest-passes': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/guests': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/people': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/cafe': ['super_admin', 'admin', 'cafe_staff'],
  '/admin/cafe-menu': ['super_admin', 'admin', 'cafe_staff'],
  '/admin/childcare': ['super_admin', 'admin', 'childcare_staff'],
  '/admin/classes': ['super_admin', 'admin', 'manager', 'class_instructor'],
  '/admin/class-roster/:sessionId': ['super_admin', 'admin', 'manager', 'front_desk', 'class_instructor'],
  '/admin/class-types': ['super_admin', 'admin', 'manager'],
  '/admin/class-types/:id': ['super_admin', 'admin', 'manager'],
  '/admin/class-schedules': ['super_admin', 'admin', 'manager'],
  '/admin/instructors': ['super_admin', 'admin', 'manager'],
  '/admin/front-desk': ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff'],
  '/admin/spa-management': ['super_admin', 'admin', 'manager', 'spa_staff', 'front_desk'],
  '/admin/mothers-day': ['super_admin', 'admin', 'manager', 'spa_staff', 'front_desk'],
  '/admin/equipment': ['super_admin', 'admin', 'manager'],
  '/admin/agreements': ['super_admin', 'admin', 'manager'],
  '/admin/emails': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/settings': ['super_admin', 'admin'],
  '/admin/email-templates': ['super_admin', 'admin'],
  '/admin/email-templates/payment-failed': ['super_admin', 'admin'],
  '/admin/email-templates/card-declined': ['super_admin', 'admin'],
  '/admin/staff-roles': ['super_admin', 'admin'],
  '/admin/staff-roles/:userId': ['super_admin', 'admin'],
  '/admin/blocked': ['super_admin', 'admin', 'manager'],
  '/admin/revenue-analytics': ['super_admin'],
  '/admin/reports': ['super_admin'],
  '/admin/marketing': ['super_admin', 'admin'],
  '/admin/non-member-accounts': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/non-member-accounts/:userId': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/merch': ['super_admin', 'admin', 'manager'],
  '/admin/portal': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/staff-hub': ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff', 'class_instructor', 'cafe_staff', 'childcare_staff'],
  '/admin/staff-schedule': ['super_admin', 'admin', 'manager', 'front_desk'],
};

// Convert a pattern like '/admin/members/:id' to a regex
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

// Helper to check if a role can access a page
export function canAccessPage(userRoles: AppRole[], path: string): boolean {
  // Super admin can access everything
  if (userRoles.includes('super_admin')) return true;
  
  // Strip query params and trailing slashes for matching
  const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
  
  // Try exact match first
  const exactRoles = PAGE_PERMISSIONS[cleanPath];
  if (exactRoles) {
    return userRoles.some(role => exactRoles.includes(role));
  }
  
  // Try pattern matching for parameterized routes
  for (const [pattern, allowedRoles] of Object.entries(PAGE_PERMISSIONS)) {
    if (!pattern.includes(':')) continue;
    if (patternToRegex(pattern).test(cleanPath)) {
      return userRoles.some(role => allowedRoles.includes(role));
    }
  }
  
  return false;
}

// Get the default redirect page based on user's roles
export function getDefaultAdminPage(userRoles: AppRole[]): string {
  if (userRoles.includes('super_admin') || userRoles.includes('admin') || userRoles.includes('manager')) {
    return '/admin';
  }
  if (userRoles.includes('front_desk')) {
    return '/frontdesk';
  }
  if (userRoles.includes('spa_staff')) {
    return '/admin/appointments';
  }
  if (userRoles.includes('class_instructor')) {
    return '/admin/classes';
  }
  if (userRoles.includes('cafe_staff')) {
    return '/admin/cafe';
  }
  if (userRoles.includes('childcare_staff')) {
    return '/admin/childcare';
  }
  return '/admin';
}
