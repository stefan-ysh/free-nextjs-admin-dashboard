'use client';

import { useCallback, useMemo } from 'react';

import { useAuth, type AuthUser } from '@/app/auth-context';
import { mapAuthRole } from '@/lib/auth/roles';
import { PermissionConfig, Permissions } from '@/lib/permissions';
import {
  UserProfile,
  UserRole,
  hasRole,
  hasAnyRole,
  hasAllRoles,
} from '@/types/user';

export type PermissionName = keyof typeof Permissions;

const PLACEHOLDER_DATE = '1970-01-01T00:00:00.000Z';

function normalizeAuthRoles(user: AuthUser): UserRole[] {
  const rawRoles: string[] = Array.isArray(user.roles) && user.roles.length ? user.roles : user.role ? [user.role] : [];
  const mapped = rawRoles.map(mapAuthRole);
  if (!mapped.length) {
    return [UserRole.EMPLOYEE];
  }
  return [...new Set(mapped)];
}

function resolvePrimaryRole(user: AuthUser, fallback: UserRole): UserRole {
  if (user.primaryRole) {
    return mapAuthRole(user.primaryRole);
  }
  return fallback;
}

function buildPermissionUser(user: AuthUser): UserProfile {
  const resolvedRoles = normalizeAuthRoles(user);
  const primaryRole = resolvePrimaryRole(user, resolvedRoles[0] ?? UserRole.EMPLOYEE);
  const roles = resolvedRoles.length ? resolvedRoles : [primaryRole];
  return {
    id: user.id,
    email: user.email,
    roles,
    primaryRole,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName ?? user.email.split('@')[0],
    phone: null,
    avatarUrl: user.avatarUrl,
    employeeCode: null,
    department: null,
    jobTitle: user.jobTitle,
    employmentStatus: null,
    hireDate: null,
    terminationDate: null,
    managerId: null,
    location: null,
    bio: null,
    city: null,
    country: null,
    postalCode: null,
    taxId: null,
    socialLinks: {},
    customFields: {},
    isActive: true,
    emailVerified: true,
    createdAt: PLACEHOLDER_DATE,
    updatedAt: PLACEHOLDER_DATE,
    createdBy: null,
    lastLoginAt: null,
    passwordUpdatedAt: null,
  };
}

function evaluatePermission(user: UserProfile, config: PermissionConfig): boolean {
  if (hasRole(user, UserRole.SUPER_ADMIN)) {
    return true;
  }

  if (config.anyRoles?.length) {
    if (!hasAnyRole(user, config.anyRoles)) {
      return false;
    }
  }

  if (config.allRoles?.length) {
    if (!hasAllRoles(user, config.allRoles)) {
      return false;
    }
  }

  if (config.customCheck) {
    try {
      const result = config.customCheck(user);
      if (typeof result === 'boolean') {
        return result;
      }
      console.warn('自定义权限检查返回 Promise，前端暂不支持异步校验');
      return false;
    } catch (error) {
      console.warn('自定义权限检查失败', error);
      return false;
    }
  }

  return true;
}

export function usePermissions() {
  const { user, loading } = useAuth();

  const permissionUser = useMemo(() => {
    if (!user) return null;
    return buildPermissionUser(user);
  }, [user]);

  const hasPermission = useCallback(
    (permission: PermissionName | PermissionConfig) => {
      if (!permissionUser) {
        return false;
      }
      const config =
        typeof permission === 'string' ? Permissions[permission] : permission;
      return evaluatePermission(permissionUser, config);
    },
    [permissionUser]
  );

  return {
    user: permissionUser,
    loading,
    hasPermission,
  };
}
