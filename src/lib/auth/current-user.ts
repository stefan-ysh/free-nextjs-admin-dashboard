import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from './constants';
import { findActiveSession, SessionRecord } from './session';
import { findUserById, UserRecord } from './user';

export type CurrentUserContext = {
  token: string;
  session: SessionRecord;
  user: UserRecord;
};

export async function getCurrentUser(): Promise<CurrentUserContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await findActiveSession(token);
  if (!session) return null;

  const user = await findUserById(session.user_id);
  if (!user) return null;

  return { token, session, user };
}

export async function requireCurrentUser(): Promise<CurrentUserContext> {
  const context = await getCurrentUser();
  if (!context) {
    throw new Error('UNAUTHENTICATED');
  }
  return context;
}
