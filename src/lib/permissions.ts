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
export const PAGE_PERMISSIONS: Record<string, AppRole[]> = {
  '/admin': ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff', 'class_instructor', 'cafe_staff', 'childcare_staff'],
  '/admin/dashboard': ['super_admin', 'admin', 'manager'],
  '/admin/check-in': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/members': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/applications': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/appointments': ['super_admin', 'admin', 'manager', 'front_desk', 'spa_staff'],
  '/admin/payments': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/guest-passes': ['super_admin', 'admin', 'manager', 'front_desk'],
  '/admin/cafe': ['super_admin', 'admin', 'cafe_staff'],
  '/admin/childcare': ['super_admin', 'admin', 'childcare_staff'],
  '/admin/classes': ['super_admin', 'admin', 'class_instructor'],
  '/admin/settings': ['super_admin', 'admin'],
  '/admin/staff-roles': ['super_admin', 'admin'],
};

// Helper to check if a role can access a page
export function canAccessPage(userRoles: AppRole[], path: string): boolean {
  // Super admin can access everything
  if (userRoles.includes('super_admin')) return true;
  
  const allowedRoles = PAGE_PERMISSIONS[path];
  if (!allowedRoles) return false;
  
  return userRoles.some(role => allowedRoles.includes(role));
}

// Get the default redirect page based on user's roles
export function getDefaultAdminPage(userRoles: AppRole[]): string {
  if (userRoles.includes('super_admin') || userRoles.includes('admin') || userRoles.includes('manager')) {
    return '/admin';
  }
  if (userRoles.includes('front_desk')) {
    return '/admin/check-in';
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
