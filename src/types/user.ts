/**
 * 用户角色枚举
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  APPROVER = 'approver',
  FINANCE_DIRECTOR = 'finance_director',
  FINANCE_SCHOOL = 'finance_school',
  FINANCE_COMPANY = 'finance_company',
  EMPLOYEE = 'employee',
}

/**
 * 员工状态
 */
export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

/**
 * 社交链接
 */
export type SocialLinks = Record<string, string | null>;

/**
 * 用户记录（完整，含密码哈希）
 */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  
  // 角色
  roles: UserRole[];
  primaryRole: UserRole;
  
  // 基本信息
  displayName: string;
  phone: string | null;
  
  // 员工信息（可选）
  employeeCode: string | null;
  department: string | null;
  jobTitle: string | null;
  employmentStatus: EmploymentStatus | null;
  hireDate: string | null;
  terminationDate: string | null;
  managerId: string | null;
  location: string | null;
  
  // 扩展信息
  bio: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  taxId: string | null;
  socialLinks: SocialLinks;
  customFields: Record<string, unknown>;
  
  // 状态
  isActive: boolean;
  emailVerified: boolean;
  
  // 审计
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
}

/**
 * 用户资料（不含密码）
 */
export type UserProfile = Omit<UserRecord, 'passwordHash'>;

/**
 * 员工信息（从用户中提取）
 */
export interface EmployeeInfo {
  employeeCode: string;
  department: string | null;
  jobTitle: string | null;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  managerId: string | null;
  location: string | null;
}

/**
 * 创建用户输入
 */
export interface CreateUserInput {
  email: string;
  password: string;
  roles?: UserRole[];
  primaryRole?: UserRole;
  displayName?: string;
  
  // 员工信息（可选）
  employeeCode?: string;
  department?: string;
  jobTitle?: string;
  employmentStatus?: EmploymentStatus;
  hireDate?: string;
  managerId?: string;
}

/**
 * 更新用户资料输入
 */
export interface UpdateUserProfileInput {
  displayName?: string;
  phone?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  taxId?: string | null;
  socialLinks?: SocialLinks | null;
}

/**
 * 更新员工信息输入
 */
export interface UpdateEmployeeInfoInput {
  employeeCode?: string;
  department?: string | null;
  jobTitle?: string | null;
  employmentStatus?: EmploymentStatus;
  hireDate?: string | null;
  terminationDate?: string | null;
  managerId?: string | null;
  location?: string | null;
}

/**
 * 用户列表查询参数
 */
export interface ListUsersParams {
  search?: string;
  roles?: UserRole[];
  department?: string;
  employmentStatus?: EmploymentStatus | 'all';
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'displayName' | 'department' | 'employmentStatus';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 用户列表结果
 */
export interface ListUsersResult {
  items: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 辅助函数：判断是否是员工
 */
export function isEmployee(user: UserRecord | UserProfile): boolean {
  return user.employeeCode != null;
}

/**
 * 辅助函数：判断用户是否有指定角色
 */
export function hasRole(user: UserRecord | UserProfile, role: UserRole): boolean {
  return user.roles.includes(role);
}

/**
 * 辅助函数：判断用户是否有任一指定角色
 */
export function hasAnyRole(user: UserRecord | UserProfile, roles: UserRole[]): boolean {
  return roles.some(role => user.roles.includes(role));
}

/**
 * 辅助函数：判断用户是否有所有指定角色
 */
export function hasAllRoles(user: UserRecord | UserProfile, roles: UserRole[]): boolean {
  return roles.every(role => user.roles.includes(role));
}

/**
 * 辅助函数：获取员工信息（类型安全）
 */
export function getEmployeeInfo(user: UserRecord | UserProfile): EmployeeInfo | null {
  if (!isEmployee(user)) return null;
  
  return {
    employeeCode: user.employeeCode!,
    department: user.department,
    jobTitle: user.jobTitle,
    employmentStatus: user.employmentStatus!,
    hireDate: user.hireDate,
    terminationDate: user.terminationDate,
    managerId: user.managerId,
    location: user.location,
  };
}

/**
 * 辅助函数：判断用户是否是管理员（超级管理员或管理员）
 */
export function isAdmin(user: UserRecord | UserProfile): boolean {
  return user.primaryRole === UserRole.SUPER_ADMIN;
}
