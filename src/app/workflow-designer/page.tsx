import { redirect } from 'next/navigation';

import PurchaseWorkflowEditor from '@/components/purchases/PurchaseWorkflowEditor';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import { checkPermission, Permissions } from '@/lib/permissions';

export default async function WorkflowDesignerPage() {
  const context = await requireCurrentUser();
  const permissionUser = await toPermissionUser(context.user);
  const permission = await checkPermission(permissionUser, Permissions.PURCHASE_APPROVE);

  if (!permission.allowed) {
    redirect('/');
  }

  return <PurchaseWorkflowEditor />;
}
