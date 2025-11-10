import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { findActiveSession } from '@/lib/auth/session';
import { findUserById } from '@/lib/auth/user';
import AdminLayoutClient from '@/layout/AdminLayoutClient';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect('/signin');
  }

  const session = await findActiveSession(token);
  if (!session) {
    redirect('/signin');
  }

  const user = await findUserById(session.user_id);
  if (!user) {
    redirect('/signin');
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
