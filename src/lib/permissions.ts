import { UserProfile, UserRole } from '@/types/user';

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

function isSuperAdminReadonlyPermission(config: PermissionConfig): boolean {
  if (!config.anyRoles?.includes(UserRole.SUPER_ADMIN)) return false;
  if (config.customCheck) return false;
  return true;
}

function resolveActiveRole(user: UserProfile): UserRole {
  if (user.primaryRole) return user.primaryRole;
  return user.roles[0] ?? UserRole.EMPLOYEE;
}

function hasAnyActiveRole(user: UserProfile, roles: UserRole[]): boolean {
  const activeRole = resolveActiveRole(user);
  return roles.includes(activeRole);
}

function hasAllActiveRoles(user: UserProfile, roles: UserRole[]): boolean {
  const activeRole = resolveActiveRole(user);
  return roles.every((role) => role === activeRole);
}

/**
 * 检查用户权限
 */
export async function checkPermission(
  user: UserProfile,
  config: PermissionConfig
): Promise<PermissionCheckResult> {
  const activeRole = resolveActiveRole(user);
  // 超级管理员为只读兜底：仅允许显式声明为可读的权限
  if (activeRole === UserRole.SUPER_ADMIN) {
    const allowed = isSuperAdminReadonlyPermission(config);
    return allowed
      ? { allowed: true }
      : { allowed: false, reason: '超级管理员为只读角色，不参与流程操作' };
  }
  
  // 检查 anyRoles（满足任一即可）
  if (config.anyRoles && config.anyRoles.length > 0) {
    if (!hasAnyActiveRole(user, config.anyRoles)) {
      return {
        allowed: false,
        reason: `需要以下任一角色: ${config.anyRoles.join(', ')}`,
      };
    }
  }
  
  // 检查 allRoles（必须全部满足）
  if (config.allRoles && config.allRoles.length > 0) {
    if (!hasAllActiveRoles(user, config.allRoles)) {
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
    anyRoles: [UserRole.SUPER_ADMIN],
  } as PermissionConfig,
  
  USER_CREATE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER],
  } as PermissionConfig,
  
  USER_UPDATE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER],
  } as PermissionConfig,
  
  USER_DELETE: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER],
  } as PermissionConfig,
  
  USER_ASSIGN_ROLES: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER],
  } as PermissionConfig,
  
  // ============ 采购管理 ============
  PURCHASE_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER, UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,
  

  
  PURCHASE_CREATE: {
    // 超级管理员只读，不参与流程创建
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN,
  } as PermissionConfig,
  
  PURCHASE_UPDATE: {
    // 只能更新自己的草稿和被驳回的记录
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN, // 在业务逻辑层进一步检查
  } as PermissionConfig,
  
  PURCHASE_DELETE: {
    // 只能删除自己的草稿和被驳回的记录
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN, // 在业务逻辑层进一步检查
  } as PermissionConfig,
  
  PURCHASE_SUBMIT: {
    // 可以提交自己的采购记录
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN, // 在业务逻辑层进一步检查
  } as PermissionConfig,
  
  PURCHASE_APPROVE: {
    anyRoles: [UserRole.APPROVER],
  } as PermissionConfig,
  
  PURCHASE_REJECT: {
    anyRoles: [UserRole.APPROVER],
  } as PermissionConfig,
  
  PURCHASE_MONITOR_VIEW: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER],
  } as PermissionConfig,

  PURCHASE_AUDIT_VIEW: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER],
  } as PermissionConfig,

  // ============ 报销管理 ============
  REIMBURSEMENT_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.APPROVER, UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  REIMBURSEMENT_CREATE: {
    // 超级管理员只读，不参与流程创建
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN,
  } as PermissionConfig,

  REIMBURSEMENT_UPDATE: {
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN, // 在业务逻辑层进一步检查
  } as PermissionConfig,

  REIMBURSEMENT_SUBMIT: {
    customCheck: (user: UserProfile) => resolveActiveRole(user) !== UserRole.SUPER_ADMIN, // 在业务逻辑层进一步检查
  } as PermissionConfig,

  REIMBURSEMENT_APPROVE: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  REIMBURSEMENT_REJECT: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  REIMBURSEMENT_PAY: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,
  
  // ============ 财务管理 ============
  FINANCE_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN, UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,
  
  FINANCE_MANAGE: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  // ============ 进销存管理 ============
  INVENTORY_VIEW_DASHBOARD: {
    anyRoles: [UserRole.SUPER_ADMIN],
  } as PermissionConfig,

  INVENTORY_MANAGE_ITEMS: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  INVENTORY_MANAGE_WAREHOUSE: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  INVENTORY_OPERATE_INBOUND: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY: {
    anyRoles: [UserRole.EMPLOYEE],
  } as PermissionConfig,

  INVENTORY_OPERATE_OUTBOUND: {
    anyRoles: [UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY],
  } as PermissionConfig,

  INVENTORY_VIEW_ALL: {
    anyRoles: [UserRole.SUPER_ADMIN],
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
  // 超级管理员、管理员可以访问所有用户数据
  if (resolveActiveRole(currentUser) === UserRole.SUPER_ADMIN) {
    return true;
  }
  
  // 可以访问自己的数据
  if (currentUser.id === targetUserId) {
    return true;
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
  // 超级管理员可以访问所有部门
  if (resolveActiveRole(user) === UserRole.SUPER_ADMIN) {
    return true;
  }

  // 财务角色可访问全部部门数据（用于审批与打款）
  if (hasAnyActiveRole(user, [UserRole.APPROVER, UserRole.FINANCE_DIRECTOR, UserRole.FINANCE_SCHOOL, UserRole.FINANCE_COMPANY])) {
    return true;
  }

  // 员工只能访问自己的部门
  if (user.department === department) {
    return true;
  }
  
  return false;
}


/**
 * 检查用户是否可以编辑采购记录
 */
export function canEditPurchase(
  user: UserProfile,
  purchase: { createdBy: string; status: string; reimbursementStatus?: string | null }
): boolean {
  // 已打款记录不允许继续编辑
  if (purchase.status === 'paid') {
    return false;
  }

  // 超级管理员只读，不参与流程编辑
  if (resolveActiveRole(user) === UserRole.SUPER_ADMIN) {
    return false;
  }
  
  // 只能编辑自己的记录
  if (user.id !== purchase.createdBy) {
    return false;
  }
  
  // 草稿/驳回始终可编辑
  if (purchase.status === 'draft' || purchase.status === 'rejected') {
    return true;
  }

  return false;
}

/**
 * 检查用户是否可以删除采购记录
 */
export function canDeletePurchase(
  user: UserProfile,
  purchase: { createdBy: string; status: string }
): boolean {
  // 超级管理员只读，不参与流程删除
  if (resolveActiveRole(user) === UserRole.SUPER_ADMIN) {
    return false;
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
  
  // 采购管理
  viewAllPurchases: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_VIEW_ALL),
  approvePurchase: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_APPROVE),
  rejectPurchase: (user: UserProfile) => checkPermission(user, Permissions.PURCHASE_REJECT),

  // 报销管理
  viewAllReimbursements: (user: UserProfile) => checkPermission(user, Permissions.REIMBURSEMENT_VIEW_ALL),
  createReimbursement: (user: UserProfile) => checkPermission(user, Permissions.REIMBURSEMENT_CREATE),
  approveReimbursement: (user: UserProfile) => checkPermission(user, Permissions.REIMBURSEMENT_APPROVE),
  rejectReimbursement: (user: UserProfile) => checkPermission(user, Permissions.REIMBURSEMENT_REJECT),
  payReimbursement: (user: UserProfile) => checkPermission(user, Permissions.REIMBURSEMENT_PAY),
  
  // 财务管理
  viewFinanceData: (user: UserProfile) => checkPermission(user, Permissions.FINANCE_VIEW_ALL),
  manageFinance: (user: UserProfile) => checkPermission(user, Permissions.FINANCE_MANAGE),
};
