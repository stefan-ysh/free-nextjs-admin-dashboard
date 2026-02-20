import { UserRole } from '@/types/user';

export const AUTH_ROLE_VALUES = [
  'super_admin',
  'approver',
  'admin',
  'finance_admin',
  'finance',
  'finance_director',
  'finance_school',
  'finance_company',
  'staff',
  'employee',
] as const;

export type AuthUserRole = (typeof AUTH_ROLE_VALUES)[number];

const ROLE_MAPPING: Record<AuthUserRole, UserRole> = {
  super_admin: UserRole.SUPER_ADMIN,
  approver: UserRole.APPROVER,
  admin: UserRole.APPROVER,         // 历史兼容：admin → 审批管理员
  finance_admin: UserRole.APPROVER,  // 历史兼容：finance_admin → 审批管理员
  finance: UserRole.APPROVER,        // 历史兼容：finance → 审批管理员
  finance_director: UserRole.FINANCE_DIRECTOR,
  finance_school: UserRole.FINANCE_SCHOOL,
  finance_company: UserRole.FINANCE_COMPANY,
  staff: UserRole.EMPLOYEE,
  employee: UserRole.EMPLOYEE,
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
