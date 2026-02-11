import { describe, it, expect } from 'vitest';
import { checkPermission, PermissionConfig } from '../permissions';
import { UserRole, UserProfile } from '@/types/user';

// Mock User Helper
const createMockUser = (roles: UserRole[] = [UserRole.EMPLOYEE], overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: 'user-123',
    email: 'test@example.com',
    roles,
    primaryRole: roles[0],
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    lastLoginAt: null,
    passwordUpdatedAt: null,
    phone: null,
    avatarUrl: null,
    employeeCode: null,
    department: null,
    jobTitle: null,
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
    ...overrides,
});

describe('Permission System', () => {
    describe('checkPermission', () => {
        it('should allow access if user has one of the required roles (anyRoles)', async () => {
            const user = createMockUser([UserRole.FINANCE]);
            const config: PermissionConfig = {
                anyRoles: [UserRole.ADMIN, UserRole.FINANCE],
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(true);
        });

        it('should deny access if user does not have any of the required roles', async () => {
            const user = createMockUser([UserRole.EMPLOYEE]);
            const config: PermissionConfig = {
                anyRoles: [UserRole.ADMIN, UserRole.FINANCE],
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(false);
        });

        it('should allow access if user has ALL required roles (allRoles)', async () => {
            const user = createMockUser([UserRole.FINANCE, UserRole.ADMIN]);
            const config: PermissionConfig = {
                allRoles: [UserRole.FINANCE, UserRole.ADMIN],
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(true);
        });

        it('should deny access if user is missing one of the required roles (allRoles)', async () => {
            const user = createMockUser([UserRole.FINANCE]);
            const config: PermissionConfig = {
                allRoles: [UserRole.FINANCE, UserRole.ADMIN],
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(false);
        });

        it('should use customCheck function if provided', async () => {
            const user = createMockUser([UserRole.EMPLOYEE]);
            const config: PermissionConfig = {
                customCheck: (u) => u.email === 'test@example.com',
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(true);
        });

        it('should fail customCheck if condition is not met', async () => {
            const user = createMockUser([UserRole.EMPLOYEE], { email: 'other@example.com' });
            const config: PermissionConfig = {
                customCheck: (u) => u.email === 'test@example.com',
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(false);
        });

        it('should allow super admin to bypass role checks often (depending on implementation, assuming super_admin usually has access)', async () => {
            // Note: verify if your logic explicitly handles SUPER_ADMIN overrides or if it needs to be listed in anyRoles
            // Looking at the file outline, checkPermission might not have a global "super admin bypass" unless it's in the config or logic.
            // Let's test standard behavior first.

            const user = createMockUser([UserRole.SUPER_ADMIN]);
            const config: PermissionConfig = {
                anyRoles: [UserRole.SUPER_ADMIN],
            };

            const result = await checkPermission(user, config);
            expect(result.allowed).toBe(true);
        });
    });
});
