import { requireCurrentUser } from '@/lib/auth/current-user';
import MobileNotificationsClient from '@/components/mobile-workflow/MobileNotificationsClient';

export default async function MobileNotificationsPage() {
  await requireCurrentUser();
  return <MobileNotificationsClient />;
}
