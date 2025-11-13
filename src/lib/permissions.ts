import { NextRequest } from 'next/server';
import { UserProfile, UserRole, hasRole, hasAnyRole, hasAllRoles, isAdmin, isFinance } from '@/types/user';

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 权限配置
 */
export interface PermissionConfig {
  // 需要的角色（满足任一即可）
  anyRoles?: UserRole[];
  // 需要的角色（必须全部满足）
  allRoles?: UserRole[];
  // 自定义权限检查函数
  customCheck?: (user: UserProfile) => boolean | Promise<boolean>;
}

/**
 * 检查用户权限
 */
export async function checkPermission(
  user: UserProfile,
  config: PermissionConfig
): Promise<PermissionCheckResult> {
  // 超级管理员拥有所有权限
  if (hasRole(user, UserRole.SUPER_ADMIN)) {
    return { allowed: true };
  }
  
  // 检查 anyRoles（满足任一即可）
  if (config.anyRoles && config.anyRoles.length > 0) {
    if (!hasAnyRole(user, config.anyRoles)) {
      return {
        allowed: false,
        reason: `需要以下任一角色: ${config.anyRoles.join(', ')}`,
      };
    }
  }
  
  // 检查 allRoles（必须全部满足）
  if (config.allRoles && config.allRoles.length > 0) {
    if (!hasAllRoles(user, config.allRoles)) {
      return {
        allowed: false,
        reason: `需要以下所有角色: ${config.allRoles.join(', ')}`,
      };
    }
  }
  
  // 自定义检查
  if (config.customCheck) {
    const customResult = await config.customCheck(user);
    if (!customResult) {
      return {
        allowed: false,
        reason: '自定义权限检查失败',
      };
    }
  }
  
  return { allowed: true };
}

/**
 * 预定义权限配置
 */
export const Permissions = {
  // ============ 用户管理 ============
  USER_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR],
  } as PermissionConfig,
  
  USER_CREATE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR],
  } as PermissionConfig,
  
  USER_UPDATE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR],
  } as PermissionConfig,
  
  USER_DELETE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  } as PermissionConfig,
  
  USER_ASSIGN_ROLES: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  } as PermissionConfig,
  
  // ============ 项目管理 ============
  PROJECT_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE, UserRole.DEPARTMENT_MANAGER],
  } as PermissionConfig,
  
  PROJECT_CREATE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_MANAGER],
  } as PermissionConfig,
  
  PROJECT_UPDATE: {
    customCheck: (user: UserProfile) => {
      // 管理员和部门经理可以更新项目
      return hasAnyRole(user, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.DEPARTMENT_MANAGER]);
    },
  } as PermissionConfig,
  
  PROJECT_DELETE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  } as PermissionConfig,
  
  // ============ 采购管理 ============
  PURCHASE_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE],
  } as PermissionConfig,
  
  PURCHASE_VIEW_DEPARTMENT: {
    anyRoles: [UserRole.DEPARTMENT_MANAGER],
  } as PermissionConfig,
  
  PURCHASE_CREATE: {
    // 所有角色都可以创建采购记录
    customCheck: () => true,
  } as PermissionConfig,
  
  PURCHASE_UPDATE: {
    // 只能更新自己的草稿和被驳回的记录
    customCheck: () => true, // 在业务逻辑层进一步检查
  } as PermissionConfig,
  
  PURCHASE_DELETE: {
    // 只能删除自己的草稿和被驳回的记录
    customCheck: () => true, // 在业务逻辑层进一步检查
  } as PermissionConfig,
  
  PURCHASE_SUBMIT: {
    // 可以提交自己的采购记录
    customCheck: () => true, // 在业务逻辑层进一步检查
  } as PermissionConfig,
  
  PURCHASE_APPROVE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE],
  } as PermissionConfig,
  
  PURCHASE_REJECT: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE],
  } as PermissionConfig,
  
  PURCHASE_PAY: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE],
  } as PermissionConfig,
  
  // ============ 财务管理 ============
  FINANCE_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE],
  } as PermissionConfig,
  
  FINANCE_MANAGE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE],
  } as PermissionConfig,
};

/**
 * 资源所有权检查
 */
export function isResourceOwner(user: UserProfile, resourceOwnerId: string): boolean {
  return user.id === resourceOwnerId;
}

/**
 * 检查用户是否可以访问指定用户的数据
 */
export function canAccessUserData(
  currentUser: UserProfile,
  targetUserId: string
): boolean {
  // 超级管理员、管理员、HR 可以访问所有用户数据
  if (hasAnyRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR])) {
    return true;
  }
  
  // 可以访问自己的数据
  if (currentUser.id === targetUserId) {
    return true;
  }
  
  // 部门经理可以访问本部门员工数据
  if (hasRole(currentUser, UserRole.DEPARTMENT_MANAGER) && currentUser.department) {
    // 这里需要查询目标用户的部门，在实际使用时需要传入 targetUser
    // 暂时返回 false，在具体业务逻辑中处理
    return false;
  }
  
  return false;
}

/**
 * 检查用户是否可以访问部门数据
 */
export function canAccessDepartmentData(
  user: UserProfile,
  department: string
): boolean {
  // 管理员可以访问所有部门
  if (isAdmin(user)) {
    return true;
  }
  
  // 财务可以访问所有部门
  if (isFinance(user)) {
    return true;
  }
  
  // 部门经理可以访问自己的部门
  if (hasRole(user, UserRole.DEPARTMENT_MANAGER) && user.department === department) {
    return true;
  }
  
  // 员工只能访问自己的部门
  if (user.department === department) {
    return true;
  }
  
  return false;
}

/**
 * 检查用户是否可以编辑项目
 */
export function canEditProject(
  user: UserProfile,
  projectManagerId: string
): boolean {
  // 管理员可以编辑所有项目
  if (isAdmin(user)) {
    return true;
  }
  
  // 项目经理可以编辑自己的项目
  if (user.id === projectManagerId) {
    return true;
  }
  
  return false;
}

/**
 * 检查用户是否可以编辑采购记录
 */
export function canEditPurchase(
  user: UserProfile,
  purchase: { createdBy: string; status: string }
): boolean {
  // 管理员可以编辑所有记录
  if (isAdmin(user)) {
    return true;
  }
  
  // 只能编辑自己的记录
  if (user.id !== purchase.createdBy) {
    return false;
  }
  
  // 只能编辑草稿和被驳回的记录
  return purchase.status === 'draft' || purchase.status === 'rejected';
}

/**
 * 检查用户是否可以删除采购记录
 */
export function canDeletePurchase(
  user: UserProfile,
  purchase: { createdBy: string; status: string }
): boolean {
  // 管理员可以删除（除了已打款的）
  if (isAdmin(user) && purchase.status !== 'paid') {
    return true;
  }
  
  // 只能删除自己的记录
  if (user.id !== purchase.createdBy) {
    return false;
  }
  
  // 只能删除草稿和被驳回的记录
  return purchase.status === 'draft' || purchase.status === 'rejected';
}

/**
 * Express 风格的中间件包装器（用于 API 路由）
 */
export function requirePermission(config: PermissionConfig) {
  return async (user: UserProfile) => {
    const result = await checkPermission(user, config);
    if (!result.allowed) {
      throw new Error(`PERMISSION_DENIED: ${result.reason || '无权限'}`);
    }
    return true;
  };
}

/**
 * 快捷权限检查函数
 */
export const can = {
  // 用户管理
  viewAllUsers: (user: UserProfile) => checkPermission(user, Permissions.USER_VIEW_ALL),
  createUser: (user: UserProfile) => checkPermission(user, Permissions.USER_CREATE),
  updateUser: (user: UserProfile) => checkPermission(user, Permissions.USER_UPDATE),
  deleteUser: (user: UserProfile) => checkPermission(user, Permissions.USER_DELETE),
  assignRoles: (user: UserProfile) => checkPermission(user, Permissions.USER_ASSIGN_ROLES),
  
  // 项目管理
  viewAllProjects: (user: UserProfile) => checkPermission(user, Permissions.PROJECT_VIEW_ALL),
  createProject: (user: UserProfile) => checkPermission(user, Permissions.PROJECT_CREATE),
  updateProject: (user: UserProfile) => checkPermission(user, Permissions.PROJECT_UPDATE),
  deleteProject: (user: UserProfile) => checkPermission(user, Permissions.PROJECT_DELETE),
  
  // 采购管理
  viewAllPurchases: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_VIEW_ALL),
  approvePurchase: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_APPROVE),
  rejectPurchase: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_REJECT),
  payPurchase: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_PAY),
  
  // 财务管理
  viewFinanceData: (user: UserProfile) => checkPermission(user, Permissions.FINANCE_VIEW_ALL),
  manageFinance: (user: UserProfile) => checkPermission(user, Permissions.FINANCE_MANAGE),
};
