import { UserRole } from '@/types/user';

export const AUTH_ROLE_VALUES = [
  'super_admin',
  'admin',
  'finance_admin',
  'finance',
  'finance_school',
  'finance_company',
  'hr',
  'department_manager',
  'staff',
  'employee',
  'inventory_manager',
  'inventory_operator',
  'auditor',
] as const;

export type AuthUserRole = (typeof AUTH_ROLE_VALUES)[number];

const ROLE_MAPPING: Record<AuthUserRole, UserRole> = {
  super_admin: UserRole.SUPER_ADMIN,
  admin: UserRole.FINANCE,
  finance_admin: UserRole.FINANCE,
  finance: UserRole.FINANCE,
  finance_school: UserRole.FINANCE_SCHOOL,
  finance_company: UserRole.FINANCE_COMPANY,
  hr: UserRole.HR,
  department_manager: UserRole.DEPARTMENT_MANAGER,
  staff: UserRole.EMPLOYEE,
  employee: UserRole.EMPLOYEE,
  inventory_manager: UserRole.INVENTORY_MANAGER,
  inventory_operator: UserRole.INVENTORY_OPERATOR,
  auditor: UserRole.AUDITOR,
};

export function mapAuthRole(role: string | null | undefined): UserRole {
  if (!role) {
    return UserRole.EMPLOYEE;
  }
  if ((ROLE_MAPPING as Record<string, UserRole>)[role]) {
    return (ROLE_MAPPING as Record<string, UserRole>)[role];
  }
  return UserRole.EMPLOYEE;
}
