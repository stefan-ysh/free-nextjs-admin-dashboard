import { UserRole } from '@/types/user';

export type UserRoleOption = {
  value: UserRole;
  label: string;
  description: string;
  category: 'core' | 'hr' | 'finance' | 'inventory' | 'audit' | 'general';
};

export const USER_ROLE_OPTIONS: UserRoleOption[] = [
  {
    value: UserRole.SUPER_ADMIN,
    label: '超级管理员',
    description: '系统最高权限，拥有全部模块的读写能力',
    category: 'core',
  },
  {
    value: UserRole.ADMIN,
    label: '管理员',
    description: '负责日常运营配置，可管理绝大多数业务模块',
    category: 'core',
  },
  {
    value: UserRole.HR,
    label: '人力 HR',
    description: '可管理员工档案、入离职与流程',
    category: 'hr',
  },
  {
    value: UserRole.FINANCE,
    label: '财务',
    description: '可查看财务总览并审批报销 / 采购',
    category: 'finance',
  },
  {
    value: UserRole.DEPARTMENT_MANAGER,
    label: '部门经理',
    description: '可管理所属部门项目与人员',
    category: 'general',
  },
  {
    value: UserRole.INVENTORY_MANAGER,
    label: '仓储主管',
    description: '可配置库存、仓库及高阶库存操作',
    category: 'inventory',
  },
  {
    value: UserRole.INVENTORY_OPERATOR,
    label: '仓储操作员',
    description: '执行日常入库、出库与盘点',
    category: 'inventory',
  },
  {
    value: UserRole.AUDITOR,
    label: '审计员',
    description: '查看关键报表与凭证的只读权限',
    category: 'audit',
  },
  {
    value: UserRole.EMPLOYEE,
    label: '员工',
    description: '基础登录权限，可访问个人信息与申请流程',
    category: 'general',
  },
];

export const USER_ROLE_LABELS: Record<UserRole, string> = USER_ROLE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<UserRole, string>
);
