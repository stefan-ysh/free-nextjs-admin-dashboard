'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  roles: string[];
  primaryRole: string;
  displayName: string | null;
  jobTitle: string | null;
  expiresAt?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.data) return null;
    const payload = data.data as Record<string, unknown>;
    const parseRoles = (input: unknown): string[] => {
      if (Array.isArray(input)) {
        return input.filter((value): value is string => typeof value === 'string');
      }
      if (typeof input === 'string' && input.trim()) {
        return [input.trim()];
      }
      return [];
    };
    const role = String(payload.role ?? '');
    const primaryRole = String(payload.primaryRole ?? role);
    const roles = parseRoles(payload.roles);
    const normalizedRoles = roles.length ? roles : [primaryRole].filter(Boolean);
    return {
      id: String(payload.id),
      email: String(payload.email ?? ''),
      role,
      roles: normalizedRoles,
      primaryRole,
      displayName: (payload.displayName as string | null | undefined) ?? null,
      jobTitle: (payload.jobTitle as string | null | undefined) ?? null,
      expiresAt: (payload.expiresAt as string | null | undefined) ?? undefined,
    };
  } catch (error) {
    console.error('Failed to fetch current auth user', error);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const current = await fetchMe();
      setUser(current);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
