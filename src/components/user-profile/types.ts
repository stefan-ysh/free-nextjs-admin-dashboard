export type ProfileData = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  jobTitle: string | null;
  phone: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  taxId: string | null;
  socialLinks: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string | null;
};

export type DeviceInfo = {
  id: string;
  deviceType: 'mobile' | 'desktop';
  rememberMe: boolean;
  createdAt: string;
  expiresAt: string;
  lastActive: string;
  isCurrent: boolean;
  userAgent: string;
};
