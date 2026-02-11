import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { findActiveSession } from '@/lib/auth/session';
import { findUserById } from '@/lib/auth/user';

const navItems = [
  { href: '/m/tasks', label: '待办' },
  { href: '/m/history', label: '已办' },
  { href: '/m/notifications', label: '通知' },
];

export default async function MobileWorkflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) redirect('/signin');
  const session = await findActiveSession(token);
  if (!session) redirect('/signin');
  const user = await findUserById(session.user_id);
  if (!user) redirect('/signin');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
          <div className="text-sm font-semibold">移动审批端</div>
          <div className="text-xs text-muted-foreground">{user.display_name ?? user.email}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 pb-20 pt-3">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto grid h-14 max-w-3xl grid-cols-3 items-center px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-10 items-center justify-center rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
