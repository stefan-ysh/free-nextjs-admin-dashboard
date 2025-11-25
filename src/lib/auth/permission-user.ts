import type { UserProfile as AuthUserProfile } from '@/lib/auth/user';
import { mapAuthRole } from '@/lib/auth/roles';
import { findUserById as findBusinessUserById } from '@/lib/users';
import type { UserProfile, UserRecord } from '@/types/user';

function stripPassword(user: UserRecord): UserProfile {
  const { passwordHash: _passwordHash, ...profile } = user;
  void _passwordHash;
  return profile;
}

function fallbackProfile(user: AuthUserProfile): UserProfile {
  const mappedRole = mapAuthRole(user.role);
  return {
    id: user.id,
    email: user.email,
    roles: [mappedRole],
    primaryRole: mappedRole,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: user.display_name ?? user.email.split('@')[0],
    phone: user.phone,
    avatarUrl: user.avatar_url,
    employeeCode: null,
    department: null,
    jobTitle: user.job_title,
    employmentStatus: null,
    hireDate: null,
    terminationDate: null,
    managerId: null,
    location: null,
    bio: user.bio,
    city: user.city,
    country: user.country,
    postalCode: user.postal_code,
    taxId: user.tax_id,
    socialLinks: user.social_links,
    customFields: {},
    isActive: true,
    emailVerified: true,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    createdBy: null,
    lastLoginAt: null,
    passwordUpdatedAt: user.password_updated_at,
  };
}

export async function toPermissionUser(user: AuthUserProfile): Promise<UserProfile> {
  try {
    const businessUser = await findBusinessUserById(user.id);
    if (businessUser) {
      return stripPassword(businessUser);
    }
  } catch (error) {
    console.warn('Failed to hydrate business user profile, fallback to auth user role mapping', error);
  }
  return fallbackProfile(user);
}
