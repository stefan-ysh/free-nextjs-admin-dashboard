import { requireCurrentUser } from '@/lib/auth/current-user';
import WorkflowWorkbenchClient from '@/components/workflow/WorkflowWorkbenchClient';

export default async function WorkflowDonePage() {
  const context = await requireCurrentUser();
  return <WorkflowWorkbenchClient currentUserId={context.user.id} initialTab="done" />;
}

