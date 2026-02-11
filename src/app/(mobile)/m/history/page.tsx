import { requireCurrentUser } from '@/lib/auth/current-user';
import MobileHistoryClient from '@/components/mobile-workflow/MobileHistoryClient';

export default async function MobileHistoryPage() {
  const context = await requireCurrentUser();
  return <MobileHistoryClient currentUserId={context.user.id} />;
}
