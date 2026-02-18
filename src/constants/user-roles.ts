import { UserRole } from '@/types/user';

export type UserRoleOption = {
  value: UserRole;
  label: string;
  description: string;
  category: 'core' | 'finance' | 'general';
};

export const USER_ROLE_OPTIONS: UserRoleOption[] = [
  {
    value: UserRole.SUPER_ADMIN,
    label: '超级管理员',
    description: '系统最高权限，拥有全部模块的读写能力',
    category: 'core',
  },
  {
    value: UserRole.FINANCE,
    label: '审批管理员',
    description: '负责采购审批、驳回与转审，不参与打款',
    category: 'finance',
  },
  {
    value: UserRole.FINANCE_SCHOOL,
    label: '学校财务',
    description: '仅负责学校组织的打款与付款异常处理',
    category: 'finance',
  },
  {
    value: UserRole.FINANCE_COMPANY,
    label: '单位财务',
    description: '仅负责单位组织的打款与付款异常处理',
    category: 'finance',
  },
  {
    value: UserRole.EMPLOYEE,
    label: '员工',
    description: '基础登录权限，可访问个人信息与申请流程',
    category: 'general',
  },
];

export const ASSIGNABLE_USER_ROLES: UserRole[] = USER_ROLE_OPTIONS.map((option) => option.value);

export const USER_ROLE_LABELS: Record<UserRole, string> = USER_ROLE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<UserRole, string>
);
