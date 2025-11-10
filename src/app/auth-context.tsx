'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
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
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.data) return null;
  const payload = data.data as Record<string, unknown>;
  return {
    id: String(payload.id),
    email: String(payload.email ?? ''),
    role: String(payload.role ?? ''),
    firstName: (payload.firstName as string | null | undefined) ?? null,
    lastName: (payload.lastName as string | null | undefined) ?? null,
    displayName: (payload.displayName as string | null | undefined) ?? null,
    jobTitle: (payload.jobTitle as string | null | undefined) ?? null,
    avatarUrl: (payload.avatarUrl as string | null | undefined) ?? null,
    expiresAt: (payload.expiresAt as string | null | undefined) ?? undefined,
  };
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
